
import logging

from datetime import datetime, timezone
from bson import ObjectId

from database.connection import documents, ocr_results
from services.ocr_service import process_document


logger = logging.getLogger(__name__)


def process_ocr_background(document_id: str):
    """
    Process uploaded documents in background
    and save OCR results in MongoDB.
    Supports Resume, ID Proof, Certificate and Other.
    """

    if not ObjectId.is_valid(document_id):
        logger.error("Invalid document ID: %s", document_id)
        return

    document_object_id = ObjectId(document_id)

    document = documents.find_one({
        "_id": document_object_id
    })

    if not document:
        logger.error("Document not found: %s", document_id)
        return

    try:
        # Update status to processing
        documents.update_one(
            {"_id": document_object_id},
            {
                "$set": {
                    "ocr_status": "processing",
                    "ocr_error": None,
                    "ocr_started_at": datetime.now(timezone.utc)
                },
                "$unset": {
                    "ocr_completed_at": "",
                    "ocr_failed_at": ""
                }
            }
        )

        # Process document according to its category
        result = process_document(
            file_path=document["file_path"],
            document_type=document.get("document_type", "other"),
            custom_document_name=document.get("custom_document_name")
        )

        extracted_data = result["extracted_data"]
        extracted_text = result["extracted_text"]

        completed_at = datetime.now(timezone.utc)

        # Save OCR results
        ocr_results.update_one(
            {"document_id": document_object_id},
            {
                "$set": {
                    "employee_id": document["employee_id"],
                    "employee_name": document.get("employee_name", ""),
                    "employee_email": document.get("employee_email", ""),
                    "document_type": document.get("document_type", "other"),
                    "custom_document_name": document.get("custom_document_name"),
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

        # Update document status
        documents.update_one(
            {"_id": document_object_id},
            {
                "$set": {
                    "ocr_status": "completed",
                    "ocr_error": None,
                    "ocr_completed_at": completed_at
                }
            }
        )

        logger.info(
            "OCR completed successfully for document: %s",
            document_id
        )

    except Exception as error:
        error_message = str(error)
        failed_at = datetime.now(timezone.utc)

        logger.exception(
            "OCR processing failed for document: %s",
            document_id
        )

        # Update document failure status
        documents.update_one(
            {"_id": document_object_id},
            {
                "$set": {
                    "ocr_status": "failed",
                    "ocr_error": error_message,
                    "ocr_failed_at": failed_at
                },
                "$unset": {
                    "ocr_completed_at": ""
                }
            }
        )

        # Save failure information
        ocr_results.update_one(
            {"document_id": document_object_id},
            {
                "$set": {
                    "employee_id": document["employee_id"],
                    "employee_name": document.get("employee_name", ""),
                    "employee_email": document.get("employee_email", ""),
                    "document_type": document.get("document_type", "other"),
                    "custom_document_name": document.get("custom_document_name"),
                    "status": "failed",
                    "error": error_message,
                    "updated_at": failed_at
                },
                "$setOnInsert": {
                    "created_at": failed_at
                },
                "$unset": {
                    "extracted_data": "",
                    "extracted_text": ""
                }
            },
            upsert=True
        )
