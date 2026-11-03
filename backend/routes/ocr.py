
import csv
import json

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
# SERIALIZE OCR RESULT
# -----------------------------------------

def serialize_ocr_result(result):

    return {
        "id": str(result["_id"]),
        "document_id": str(result["document_id"]),
        "employee_id": str(result["employee_id"]),
        "employee_name": result.get("employee_name", ""),
        "employee_email": result.get("employee_email", ""),
        "document_type": result.get("document_type", ""),
        "extracted_data": result.get("extracted_data", {}),
        "extracted_text": result.get("extracted_text", ""),
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

    # Individual employee filter
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

    headers = [
        "Employee Name",
        "Employee Email",
        "Document Type",
        "Extracted Name",
        "Extracted Email",
        "Phone",
        "Skills",
        "Education",
        "Experience",
        "OCR Status"
    ]

    rows = []

    for record in records:

        data = record.get("extracted_data", {})

        rows.append([
            record.get("employee_name", ""),
            record.get("employee_email", ""),
            record.get("document_type", ""),
            data.get("name") or "",
            data.get("email") or "",
            data.get("phone") or "",
            ", ".join(data.get("skills", [])),
            json.dumps(data.get("education", [])),
            json.dumps(data.get("experience", [])),
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

    if document.get("document_type") != "resume":
        raise HTTPException(
            status_code=400,
            detail="OCR retry is available only for resumes"
        )

    file_path = Path(document.get("file_path", ""))

    if not file_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Original document file not found"
        )

    # Atomically change status only if not already processing
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
        "ocr_status": "pending"
    }
