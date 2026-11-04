
import csv
import json
import re

from io import StringIO, BytesIO
from pathlib import Path

from bson import ObjectId
from openpyxl import Workbook

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    BackgroundTasks
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


# -----------------------------------------
# SENSITIVE DATA MASKING
# -----------------------------------------

def mask_sensitive_text(value):
    """
    Mask Aadhaar and PAN identifiers in text.
    """

    if not isinstance(value, str):
        return value

    # Mask Aadhaar numbers
    def mask_aadhaar(match):
        digits = re.sub(r"\D", "", match.group(0))
        return "XXXX XXXX " + digits[-4:]

    value = re.sub(
        r"(?<!\d)\d{4}[\s-]?\d{4}[\s-]?\d{4}(?!\d)",
        mask_aadhaar,
        value
    )

    # Mask PAN numbers
    def mask_pan(match):
        pan = match.group(0).upper()
        return "XXXXX" + pan[-5:]

    value = re.sub(
        r"\b[A-Z]{5}\d{4}[A-Z]\b",
        mask_pan,
        value,
        flags=re.IGNORECASE
    )

    return value


def mask_sensitive_data(value):
    """
    Recursively mask sensitive identifiers in dictionaries and lists.
    """

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


# -----------------------------------------
# SERIALIZE OCR RESULT
# -----------------------------------------

def serialize_ocr_result(result):

    extracted_data = mask_sensitive_data(
        result.get("extracted_data", {})
    )

    extracted_text = mask_sensitive_text(
        result.get("extracted_text", "")
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
        "created_at": (
            result["created_at"].isoformat()
            if result.get("created_at") else None
        ),
        "updated_at": (
            result["updated_at"].isoformat()
            if result.get("updated_at") else None
        )
    }


# -----------------------------------------
# GET EMPLOYEE PROFILE
# -----------------------------------------

def get_employee_profile(current_user):

    employee = employees.find_one({
        "user_id": str(current_user["_id"])
    })

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee profile not found"
        )

    return employee


# -----------------------------------------
# GET ALL OCR RESULTS
# -----------------------------------------

@router.get("/results")
def get_ocr_results(
    employee_id: str = None,
    current_user: dict = Depends(require_password_changed)
):

    if current_user["role"] == "admin":

        query = {}

        if employee_id:

            if not ObjectId.is_valid(employee_id):
                raise HTTPException(
                    status_code=400,
                    detail="Invalid employee ID"
                )

            employee = employees.find_one({
                "_id": ObjectId(employee_id)
            })

            if not employee:
                raise HTTPException(
                    status_code=404,
                    detail="Employee not found"
                )

            query["employee_id"] = employee["_id"]

    elif current_user["role"] == "employee":

        employee = get_employee_profile(current_user)

        query = {
            "employee_id": employee["_id"]
        }

    else:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    results = ocr_results.find(query).sort(
        "created_at",
        -1
    )

    return [
        serialize_ocr_result(result)
        for result in results
    ]


# -----------------------------------------
# GET SINGLE DOCUMENT OCR RESULT
# -----------------------------------------

@router.get("/results/{document_id}")
def get_single_ocr_result(
    document_id: str,
    current_user: dict = Depends(require_password_changed)
):

    if not ObjectId.is_valid(document_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid document ID"
        )

    result = ocr_results.find_one({
        "document_id": ObjectId(document_id)
    })

    if not result:
        raise HTTPException(
            status_code=404,
            detail="OCR result not found"
        )

    if current_user["role"] == "employee":

        employee = get_employee_profile(current_user)

        if result["employee_id"] != employee["_id"]:
            raise HTTPException(
                status_code=403,
                detail="Access denied"
            )

    elif current_user["role"] != "admin":

        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    return serialize_ocr_result(result)


# -----------------------------------------
# EXPORT OCR RESULTS
# -----------------------------------------

@router.get("/export")
def export_ocr_results(
    file_format: str = Query(
        "xlsx",
        alias="format"
    ),
    employee_id: str = None,
    current_user: dict = Depends(require_password_changed)
):

    # Only admin can export
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only admin can export OCR data"
        )

    if file_format not in ["xlsx", "csv", "json"]:
        raise HTTPException(
            status_code=400,
            detail="Supported formats: xlsx, csv, json"
        )

    query = {}

    if employee_id:

        if not ObjectId.is_valid(employee_id):
            raise HTTPException(
                status_code=400,
                detail="Invalid employee ID"
            )

        employee = employees.find_one({
            "_id": ObjectId(employee_id)
        })

        if not employee:
            raise HTTPException(
                status_code=404,
                detail="Employee not found"
            )

        query["employee_id"] = employee["_id"]

    results = ocr_results.find(query).sort(
        "created_at",
        -1
    )

    # All records pass through masking serializer
    records = [
        serialize_ocr_result(result)
        for result in results
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

    # CSV / EXCEL HEADERS
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

        data = record.get("extracted_data", {})

        rows.append([
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
            ", ".join(data.get("skills", []))
                if isinstance(data.get("skills"), list)
                else str(data.get("skills") or ""),
            json.dumps(data.get("education", []), ensure_ascii=False),
            json.dumps(data.get("experience", []), ensure_ascii=False),
            data.get("course_or_certificate") or "",
            data.get("institute") or "",
            data.get("issue_date") or "",
            json.dumps(data.get("sections", {}), ensure_ascii=False),
            record.get("status", "")
        ])

    # CSV EXPORT
    if file_format == "csv":

        output = StringIO()

        writer = csv.writer(output)

        writer.writerow(headers)
        writer.writerows(rows)

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
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

    # Adjust column widths
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


# -----------------------------------------
# RETRY OCR PROCESSING
# -----------------------------------------

@router.post("/retry/{document_id}")
def retry_ocr(
    document_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_password_changed)
):

    # Only admin can retry OCR
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only admin can retry OCR processing"
        )

    if not ObjectId.is_valid(document_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid document ID"
        )

    document_object_id = ObjectId(document_id)

    document = documents.find_one({
        "_id": document_object_id
    })

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found"
        )

    # Support all four document categories
    if document.get("document_type") not in {
        "resume",
        "id",
        "certificate",
        "other"
    }:
        raise HTTPException(
            status_code=400,
            detail="Unsupported document type"
        )

    file_path = Path(document.get("file_path", ""))

    if not file_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Original document file not found"
        )

    # Atomically update status
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
            status_code=409,
            detail="OCR is already pending or processing"
        )

    # Schedule background OCR
    background_tasks.add_task(
        process_ocr_background,
        document_id
    )

    return {
        "message": "OCR retry scheduled successfully",
        "document_id": document_id,
        "document_type": document.get("document_type"),
        "ocr_status": "pending"
    }
