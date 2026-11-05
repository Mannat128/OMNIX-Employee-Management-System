
import csv
import json
import re
import logging

from io import StringIO, BytesIO
from pathlib import Path
from datetime import datetime, date

from bson import ObjectId
from openpyxl import Workbook

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    BackgroundTasks,
    status
)

from fastapi.responses import StreamingResponse

from database.connection import (
    ocr_results,
    employees,
    documents
)

from dependencies.auth import require_password_changed
from services.ocr_background import process_ocr_background


router = APIRouter()
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
DOCUMENT_UPLOAD_DIR = BASE_DIR / "uploads" / "documents"

MAX_EXPORT_RECORDS = 5000

ALLOWED_DOCUMENT_TYPES = {
    "resume",
    "id",
    "certificate",
    "other"
}


# ==========================================
# SENSITIVE DATA MASKING
# ==========================================

def mask_sensitive_text(value):

    if not isinstance(value, str):
        return value

    # Mask Aadhaar numbers.
    def mask_aadhaar(match):

        digits = re.sub(r"\D", "", match.group(0))

        return "XXXX XXXX " + digits[-4:]

    value = re.sub(
        r"(?<!\d)\d{4}[\s-]?\d{4}[\s-]?\d{4}(?!\d)",
        mask_aadhaar,
        value
    )

    # Mask PAN numbers.
    def mask_pan(match):

        pan = match.group(0).upper()

        return "XXXXX" + pan[-5:]

    value = re.sub(
        r"\b[A-Z]{5}\d{4}[A-Z]\b",
        mask_pan,
        value,
        flags=re.IGNORECASE
    )

    # Mask recognizable Indian driving licence numbers.
    def mask_driving_licence(match):

        number = re.sub(
            r"[^A-Z0-9]",
            "",
            match.group(0).upper()
        )

        return "XXXX" + number[-4:]

    value = re.sub(
        r"\b[A-Z]{2}[- ]?\d{2}[- ]?\d{4,12}\b",
        mask_driving_licence,
        value,
        flags=re.IGNORECASE
    )

    return value


def mask_sensitive_data(value):

    if isinstance(value, dict):

        return {
            key: mask_sensitive_data(item)
            for key, item in value.items()
        }

    if isinstance(value, list):

        return [
            mask_sensitive_data(item)
            for item in value
        ]

    if isinstance(value, str):
        return mask_sensitive_text(value)

    return value


# ==========================================
# SAFE DATE SERIALIZATION
# ==========================================

def serialize_datetime(value):

    if isinstance(value, (datetime, date)):
        return value.isoformat()

    return value


# ==========================================
# SERIALIZE OCR RESULT
# ==========================================

def serialize_ocr_result(result):

    extracted_data = mask_sensitive_data(
        result.get("extracted_data") or {}
    )

    extracted_text = mask_sensitive_text(
        result.get("extracted_text") or ""
    )

    return {
        "id": str(result["_id"]),
        "document_id": str(result["document_id"]),
        "employee_id": str(result["employee_id"]),
        "employee_name": result.get("employee_name", ""),
        "employee_email": result.get("employee_email", ""),
        "document_type": result.get("document_type", ""),
        "custom_document_name": result.get(
            "custom_document_name"
        ),
        "extracted_data": extracted_data,
        "extracted_text": extracted_text,
        "status": result.get("status", "pending"),
        "error": result.get("error"),
        "created_at": serialize_datetime(
            result.get("created_at")
        ),
        "updated_at": serialize_datetime(
            result.get("updated_at")
        )
    }


# ==========================================
# GET EMPLOYEE PROFILE
# ==========================================

def get_employee_profile(current_user):

    employee = employees.find_one({
        "user_id": str(current_user["_id"])
    })

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found"
        )

    return employee


# ==========================================
# GET OCR QUERY BY ROLE
# ==========================================

def get_ocr_access_query(current_user, employee_id=None):

    role = current_user.get("role")

    if role == "admin":

        query = {}

        if employee_id:

            if not ObjectId.is_valid(employee_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid employee ID"
                )

            employee = employees.find_one({
                "_id": ObjectId(employee_id)
            })

            if not employee:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Employee not found"
                )

            query["employee_id"] = employee["_id"]

        return query

    if role == "employee":

        employee = get_employee_profile(current_user)

        if employee_id and employee_id != str(employee["_id"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can access only your own OCR results"
            )

        return {
            "employee_id": employee["_id"]
        }

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied"
    )


# ==========================================
# GET ALL OCR RESULTS
# ==========================================

@router.get("/results")
def get_ocr_results(
    employee_id: str = Query(None),
    current_user: dict = Depends(require_password_changed)
):

    query = get_ocr_access_query(
        current_user,
        employee_id
    )

    results = ocr_results.find(query).sort(
        "created_at",
        -1
    )

    return [
        serialize_ocr_result(result)
        for result in results
    ]


# ==========================================
# GET SINGLE OCR RESULT
# ==========================================

@router.get("/results/{document_id}")
def get_single_ocr_result(
    document_id: str,
    current_user: dict = Depends(require_password_changed)
):

    if not ObjectId.is_valid(document_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid document ID"
        )

    result = ocr_results.find_one({
        "document_id": ObjectId(document_id)
    })

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="OCR result not found"
        )

    role = current_user.get("role")

    if role == "employee":

        employee = get_employee_profile(current_user)

        if result.get("employee_id") != employee["_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

    elif role != "admin":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    return serialize_ocr_result(result)


# ==========================================
# EXPORT SAFETY HELPERS
# ==========================================

def safe_spreadsheet_value(value):

    if value is None:
        return ""

    if isinstance(value, (dict, list)):
        value = json.dumps(
            value,
            ensure_ascii=False
        )

    value = str(value)

    # Prevent spreadsheet formula injection.
    if value.lstrip().startswith(
        ("=", "+", "-", "@", "\t", "\r")
    ):
        value = "'" + value

    return value


def get_export_rows(records):

    headers = [
        "Employee Name",
        "Employee Email",
        "Document Type",
        "Custom Document Name",
        "Extracted Name",
        "Extracted Email",
        "Phone",
        "Date of Birth",
        "Gender",
        "Address",
        "Document Number (Masked)",
        "Skills",
        "Education",
        "Experience",
        "Course / Certificate",
        "Institute",
        "Issue Date",
        "Additional Sections",
        "OCR Status"
    ]

    rows = []

    for record in records:

        data = record.get("extracted_data") or {}

        skills = data.get("skills", [])

        if isinstance(skills, list):
            skills = ", ".join(str(item) for item in skills)

        row = [
            record.get("employee_name", ""),
            record.get("employee_email", ""),
            record.get("document_type", ""),
            record.get("custom_document_name") or "",
            data.get("name") or "",
            data.get("email") or "",
            data.get("phone") or "",
            data.get("date_of_birth") or "",
            data.get("gender") or "",
            data.get("address") or "",
            data.get("document_number") or "",
            skills,
            data.get("education", []),
            data.get("experience", []),
            data.get("course_or_certificate") or "",
            data.get("institute") or "",
            data.get("issue_date") or "",
            data.get("sections", {}),
            record.get("status", "")
        ]

        rows.append([
            safe_spreadsheet_value(value)
            for value in row
        ])

    return headers, rows


# ==========================================
# EXPORT OCR RESULTS
# Admin only
# ==========================================

@router.get("/export")
def export_ocr_results(
    file_format: str = Query(
        "xlsx",
        alias="format"
    ),
    employee_id: str = Query(None),
    current_user: dict = Depends(require_password_changed)
):

    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can export OCR data"
        )

    if file_format not in {"xlsx", "csv", "json"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Supported formats: xlsx, csv, json"
        )

    query = get_ocr_access_query(
        current_user,
        employee_id
    )

    cursor = ocr_results.find(query).sort(
        "created_at",
        -1
    ).limit(MAX_EXPORT_RECORDS + 1)

    raw_records = list(cursor)

    if len(raw_records) > MAX_EXPORT_RECORDS:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"Export is limited to {MAX_EXPORT_RECORDS} records. "
                "Please filter by employee."
            )
        )

    records = [
        serialize_ocr_result(record)
        for record in raw_records
    ]

    # JSON EXPORT
    if file_format == "json":

        content = json.dumps(
            records,
            indent=4,
            ensure_ascii=False
        )

        return StreamingResponse(
            iter([content]),
            media_type="application/json",
            headers={
                "Content-Disposition":
                'attachment; filename="omnix_ocr_results.json"'
            }
        )

    headers, rows = get_export_rows(records)

    # CSV EXPORT
    if file_format == "csv":

        output = StringIO()

        writer = csv.writer(output)

        writer.writerow(headers)
        writer.writerows(rows)

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition":
                'attachment; filename="omnix_ocr_results.csv"'
            }
        )

    # EXCEL EXPORT
    workbook = Workbook()

    worksheet = workbook.active
    worksheet.title = "OCR Results"

    worksheet.append(headers)

    for row in rows:
        worksheet.append(row)

    # Adjust column widths.
    for column in worksheet.columns:

        max_length = max(
            len(str(cell.value or ""))
            for cell in column
        )

        worksheet.column_dimensions[
            column[0].column_letter
        ].width = min(max_length + 3, 40)

    excel_file = BytesIO()

    workbook.save(excel_file)
    excel_file.seek(0)

    return StreamingResponse(
        excel_file,
        media_type=(
            "application/vnd.openxmlformats-officedocument."
            "spreadsheetml.sheet"
        ),
        headers={
            "Content-Disposition":
            'attachment; filename="omnix_ocr_results.xlsx"'
        }
    )


# ==========================================
# SAFE DOCUMENT PATH
# Supports new and legacy document records.
# ==========================================

def get_document_file_path(document):

    base_directory = DOCUMENT_UPLOAD_DIR.resolve()

    stored_filename = document.get("stored_filename")

    if stored_filename:

        filename = Path(stored_filename).name

        if filename != stored_filename:
            return None

        file_path = base_directory / filename

    else:

        # Backward compatibility for older records.
        legacy_path = document.get("file_path")

        if not legacy_path:
            return None

        try:
            file_path = Path(legacy_path).resolve()

        except (OSError, ValueError):
            return None

    try:

        resolved_path = file_path.resolve()

        if resolved_path.parent != base_directory:
            return None

        if not resolved_path.is_file():
            return None

        return resolved_path

    except (OSError, ValueError):
        return None


# ==========================================
# RETRY OCR PROCESSING
# Admin only
# ==========================================

@router.post("/retry/{document_id}")
def retry_ocr(
    document_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_password_changed)
):

    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can retry OCR processing"
        )

    if not ObjectId.is_valid(document_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid document ID"
        )

    document_object_id = ObjectId(document_id)

    document = documents.find_one({
        "_id": document_object_id
    })

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    document_type = document.get("document_type")

    if document_type not in ALLOWED_DOCUMENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported document type"
        )

    file_path = get_document_file_path(document)

    if not file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Original document file not found"
        )

    # Atomically move failed/completed records back to pending.
    update_result = documents.update_one(
        {
            "_id": document_object_id,
            "ocr_status": {
                "$nin": ["pending", "processing"]
            }
        },
        {
            "$set": {
                "ocr_status": "pending",
                "ocr_error": None
            },
            "$unset": {
                "ocr_completed_at": "",
                "ocr_failed_at": ""
            }
        }
    )

    if update_result.modified_count != 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="OCR is already pending or processing"
        )

    try:

        background_tasks.add_task(
            process_ocr_background,
            document_id
        )

    except Exception as error:

        logger.exception("Unable to schedule OCR retry")

        documents.update_one(
            {
                "_id": document_object_id,
                "ocr_status": "pending"
            },
            {
                "$set": {
                    "ocr_status": "failed",
                    "ocr_error": "Unable to schedule OCR processing"
                }
            }
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to schedule OCR retry"
        ) from error

    return {
        "message": "OCR retry scheduled successfully",
        "document_id": document_id,
        "document_type": document_type,
        "ocr_status": "pending"
    }
