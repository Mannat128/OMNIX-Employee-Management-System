
import logging

from pathlib import Path
from datetime import datetime, timezone

from bson import ObjectId
from pymongo import ReturnDocument

from database.connection import (
    documents,
    ocr_results,
    employees
)

from services.ocr_service import process_document


logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
DOCUMENT_UPLOAD_DIR = BASE_DIR / "uploads" / "documents"

ALLOWED_DOCUMENT_TYPES = {
    "resume",
    "id",
    "certificate",
    "other"
}


# ==========================================
# SAFE DOCUMENT FILE PATH
# Supports new and legacy documents
# ==========================================

def get_document_file_path(document):

    stored_filename = document.get("stored_filename")

    if stored_filename:

        filename = Path(stored_filename).name

        if filename != stored_filename:
            return None

        file_path = DOCUMENT_UPLOAD_DIR / filename

    else:

        legacy_path = document.get("file_path")

        if not legacy_path:
            return None

        try:
            file_path = Path(legacy_path).resolve()
            upload_directory = DOCUMENT_UPLOAD_DIR.resolve()

            if file_path.parent != upload_directory:
                return None

        except (OSError, ValueError):
            return None

    try:

        resolved_path = file_path.resolve()
        upload_directory = DOCUMENT_UPLOAD_DIR.resolve()

        if resolved_path.parent != upload_directory:
            return None

        if not resolved_path.is_file():
            return None

        return resolved_path

    except (OSError, ValueError):
        return None


# ==========================================
# MARK OCR FAILED
# ==========================================

def mark_ocr_failed(
    document_id,
    error_message="OCR processing failed"
):

    now = datetime.now(timezone.utc)

    safe_message = str(error_message)[:300]

    try:

        document = documents.find_one({
            "_id": document_id
        })

        if not document:
            return

        documents.update_one(
            {"_id": document_id},
            {
                "$set": {
                    "ocr_status": "failed",
                    "ocr_error": safe_message,
                    "ocr_failed_at": now,
                    "updated_at": now
                }
            }
        )

        employee_id = document.get("employee_id")

        if not isinstance(employee_id, ObjectId):
            return

        employee = employees.find_one({
            "_id": employee_id
        })

        ocr_results.update_one(
            {"document_id": document_id},
            {
                "$set": {
                    "document_id": document_id,
                    "employee_id": employee_id,
                    "employee_name": (
                        employee.get("name", "")
                        if employee else ""
                    ),
                    "employee_email": (
                        employee.get("email", "")
                        if employee else ""
                    ),
                    "document_type": document.get(
                        "document_type",
                        ""
                    ),
                    "custom_document_name": document.get(
                        "custom_document_name"
                    ),
                    "status": "failed",
                    "error": safe_message,
                    "updated_at": now
                },
                "$setOnInsert": {
                    "created_at": now,
                    "extracted_data": {},
                    "extracted_text": ""
                }
            },
            upsert=True
        )

    except Exception:

        logger.exception(
            "Unable to save OCR failure status for document %s",
            document_id
        )


# ==========================================
# PROCESS OCR IN BACKGROUND
# ==========================================

def process_ocr_background(document_id):

    if not ObjectId.is_valid(str(document_id)):

        logger.error("Invalid document ID received for OCR")
        return

    document_object_id = ObjectId(document_id)

    document = documents.find_one({
        "_id": document_object_id
    })

    if not document:

        logger.error(
            "OCR document not found: %s",
            document_id
        )
        return

    document_type = document.get("document_type")

    if document_type not in ALLOWED_DOCUMENT_TYPES:

        mark_ocr_failed(
            document_object_id,
            "Unsupported document type"
        )
        return

    employee_id = document.get("employee_id")

    if not isinstance(employee_id, ObjectId):

        mark_ocr_failed(
            document_object_id,
            "Invalid employee reference"
        )
        return

    employee = employees.find_one({
        "_id": employee_id
    })

    if not employee:

        mark_ocr_failed(
            document_object_id,
            "Employee record not found"
        )
        return

    file_path = get_document_file_path(document)

    if not file_path:

        mark_ocr_failed(
            document_object_id,
            "Original document file not found"
        )
        return

    # Atomically claim only pending documents.
    now = datetime.now(timezone.utc)

    claimed_document = documents.find_one_and_update(
        {
            "_id": document_object_id,
            "ocr_status": "pending"
        },
        {
            "$set": {
                "ocr_status": "processing",
                "ocr_started_at": now,
                "ocr_error": None,
                "updated_at": now
            }
        },
        return_document=ReturnDocument.AFTER
    )

    if not claimed_document:

        logger.info(
            "OCR skipped because document is not pending: %s",
            document_id
        )
        return

    try:

        # Extract text and structured information.
        result = process_document(
            file_path=str(file_path),
            document_type=document_type,
            custom_document_name=document.get(
                "custom_document_name"
            )
        )

        if not isinstance(result, dict):
            raise ValueError("Invalid OCR service response")

        extracted_data = result.get("extracted_data", {})
        extracted_text = result.get("extracted_text", "")

        if not isinstance(extracted_data, dict):
            raise ValueError("Invalid extracted data format")

        if not isinstance(extracted_text, str):
            raise ValueError("Invalid extracted text format")

        completed_at = datetime.now(timezone.utc)

        # Save OCR result in MongoDB.
        ocr_results.update_one(
            {"document_id": document_object_id},
            {
                "$set": {
                    "document_id": document_object_id,
                    "employee_id": employee_id,
                    "employee_name": employee.get("name", ""),
                    "employee_email": employee.get("email", ""),
                    "document_type": document_type,
                    "custom_document_name": document.get(
                        "custom_document_name"
                    ),
                    "extracted_data": extracted_data,
                    "extracted_text": extracted_text,
                    "status": "completed",
                    "error": None,
                    "updated_at": completed_at
                },
                "$setOnInsert": {
                    "created_at": completed_at
                }
            },
            upsert=True
        )

        documents.update_one(
            {"_id": document_object_id},
            {
                "$set": {
                    "ocr_status": "completed",
                    "ocr_error": None,
                    "ocr_completed_at": completed_at,
                    "updated_at": completed_at
                },
                "$unset": {
                    "ocr_failed_at": ""
                }
            }
        )

        logger.info(
            "OCR processing completed for document %s",
            document_id
        )

    except Exception:

        logger.exception(
            "OCR processing failed for document %s",
            document_id
        )

        mark_ocr_failed(
            document_object_id,
            "OCR processing failed. Please retry."
        )

import logging

from pathlib import Path
from datetime import datetime, timezone

from bson import ObjectId
from pymongo import ReturnDocument

from database.connection import (
    documents,
    ocr_results,
    employees
)

from services.ocr_service import process_document


logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent

DOCUMENT_UPLOAD_DIR = BASE_DIR / "uploads" / "documents"

ALLOWED_DOCUMENT_TYPES = {
    "resume",
    "id",
    "certificate",
    "other"
}


# ==========================================
# SAFE DOCUMENT FILE PATH
# Supports new and legacy documents
# ==========================================

def get_document_file_path(document):

    stored_filename = document.get("stored_filename")

    if stored_filename:

        if not isinstance(stored_filename, str):
            return None

        filename = Path(stored_filename).name

        if filename != stored_filename:
            return None

        file_path = DOCUMENT_UPLOAD_DIR / filename

    else:

        legacy_path = document.get("file_path")

        if not legacy_path:
            return None

        try:

            file_path = Path(legacy_path).resolve()

            upload_directory = DOCUMENT_UPLOAD_DIR.resolve()

            if file_path.parent != upload_directory:
                return None

        except (OSError, ValueError):
            return None

    try:

        resolved_path = file_path.resolve()

        upload_directory = DOCUMENT_UPLOAD_DIR.resolve()

        if resolved_path.parent != upload_directory:
            return None

        if not resolved_path.is_file():
            return None

        return resolved_path

    except (OSError, ValueError):
        return None


# ==========================================
# MARK OCR FAILED
# ==========================================

def mark_ocr_failed(
    document_id,
    error_message="OCR processing failed"
):

    now = datetime.now(timezone.utc)

    safe_message = str(error_message)[:300]

    try:

        document = documents.find_one({
            "_id": document_id
        })

        if not document:
            return

        documents.update_one(
            {"_id": document_id},
            {
                "$set": {
                    "ocr_status": "failed",
                    "ocr_error": safe_message,
                    "ocr_failed_at": now,
                    "updated_at": now
                }
            }
        )

        employee_id = document.get("employee_id")

        if not isinstance(employee_id, ObjectId):
            return

        employee = employees.find_one({
            "_id": employee_id
        })

        ocr_results.update_one(
            {"document_id": document_id},
            {
                "$set": {
                    "document_id": document_id,
                    "employee_id": employee_id,
                    "employee_name": (
                        employee.get("name", "")
                        if employee else ""
                    ),
                    "employee_email": (
                        employee.get("email", "")
                        if employee else ""
                    ),
                    "document_type": document.get(
                        "document_type",
                        ""
                    ),
                    "custom_document_name": document.get(
                        "custom_document_name"
                    ),
                    "status": "failed",
                    "error": safe_message,
                    "updated_at": now
                },
                "$setOnInsert": {
                    "created_at": now,
                    "extracted_data": {},
                    "extracted_text": ""
                }
            },
            upsert=True
        )

    except Exception:

        logger.exception(
            "Unable to save OCR failure status for document %s",
            document_id
        )


# ==========================================
# PROCESS OCR IN BACKGROUND
# ==========================================

def process_ocr_background(document_id):

    if not ObjectId.is_valid(str(document_id)):

        logger.error(
            "Invalid document ID received for OCR"
        )

        return

    document_object_id = ObjectId(document_id)

    document = documents.find_one({
        "_id": document_object_id
    })

    if not document:

        logger.error(
            "OCR document not found: %s",
            document_id
        )

        return

    document_type = document.get("document_type")

    if document_type not in ALLOWED_DOCUMENT_TYPES:

        mark_ocr_failed(
            document_object_id,
            "Unsupported document type"
        )

        return

    employee_id = document.get("employee_id")

    if not isinstance(employee_id, ObjectId):

        mark_ocr_failed(
            document_object_id,
            "Invalid employee reference"
        )

        return

    employee = employees.find_one({
        "_id": employee_id
    })

    if not employee:

        mark_ocr_failed(
            document_object_id,
            "Employee record not found"
        )

        return

    file_path = get_document_file_path(document)

    if not file_path:

        mark_ocr_failed(
            document_object_id,
            "Original document file not found"
        )

        return

    # Atomically claim only pending documents.
    now = datetime.now(timezone.utc)

    claimed_document = documents.find_one_and_update(
        {
            "_id": document_object_id,
            "ocr_status": "pending"
        },
        {
            "$set": {
                "ocr_status": "processing",
                "ocr_started_at": now,
                "ocr_error": None,
                "updated_at": now
            }
        },
        return_document=ReturnDocument.AFTER
    )

    if not claimed_document:

        logger.info(
            "OCR skipped because document is not pending: %s",
            document_id
        )

        return

    try:

        # Extract text and structured information.
        result = process_document(
            file_path=str(file_path),
            document_type=document_type,
            custom_document_name=document.get(
                "custom_document_name"
            )
        )

        if not isinstance(result, dict):
            raise ValueError(
                "Invalid OCR service response"
            )

        extracted_data = result.get(
            "extracted_data",
            {}
        )

        extracted_text = result.get(
            "extracted_text",
            ""
        )

        if not isinstance(extracted_data, dict):
            raise ValueError(
                "Invalid extracted data format"
            )

        if not isinstance(extracted_text, str):
            raise ValueError(
                "Invalid extracted text format"
            )

        completed_at = datetime.now(timezone.utc)

        # Save OCR result in MongoDB.
        ocr_results.update_one(
            {"document_id": document_object_id},
            {
                "$set": {
                    "document_id": document_object_id,
                    "employee_id": employee_id,
                    "employee_name": employee.get("name", ""),
                    "employee_email": employee.get("email", ""),
                    "document_type": document_type,
                    "custom_document_name": document.get(
                        "custom_document_name"
                    ),
                    "extracted_data": extracted_data,
                    "extracted_text": extracted_text,
                    "status": "completed",
                    "error": None,
                    "updated_at": completed_at
                },
                "$setOnInsert": {
                    "created_at": completed_at
                }
            },
            upsert=True
        )

        update_result = documents.update_one(
            {
                "_id": document_object_id,
                "ocr_status": "processing"
            },
            {
                "$set": {
                    "ocr_status": "completed",
                    "ocr_error": None,
                    "ocr_completed_at": completed_at,
                    "updated_at": completed_at
                },
                "$unset": {
                    "ocr_failed_at": ""
                }
            }
        )

        if update_result.modified_count != 1:

            logger.error(
                "OCR result saved but document status update failed: %s",
                document_id
            )

            return

        logger.info(
            "OCR processing completed for document %s",
            document_id
        )

    except Exception:

        logger.exception(
            "OCR processing failed for document %s",
            document_id
        )

        mark_ocr_failed(
            document_object_id,
            "OCR processing failed. Please retry."
        )
