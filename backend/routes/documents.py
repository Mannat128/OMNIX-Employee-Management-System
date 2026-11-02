
import os
import uuid

from pathlib import Path
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Form
)
from fastapi.responses import FileResponse

from database.connection import documents, employees
from dependencies.auth import get_current_user

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parents[1]
UPLOAD_DIR = BASE_DIR / "uploads" / "documents"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_FILE_SIZE = 10 * 1024 * 1024


def serialize_document(document):
    return {
        "id": str(document["_id"]),
        "employee_id": str(document["employee_id"]),
        "employee_name": document.get("employee_name", ""),
        "employee_email": document.get("employee_email", ""),
        "document_type": document["document_type"],
        "file_name": document["file_name"],
        "upload_date": document["upload_date"].isoformat(),
        "ocr_status": document.get("ocr_status", "not_started")
    }


@router.post("/upload")
async def upload_document(
    document_type: str = Form(...),
    file: UploadFile = File(...),
    employee_id: str = Form(None),
    current_user: dict = Depends(get_current_user)
):
    if document_type not in ["resume", "id", "certificate", "other"]:
        raise HTTPException(400, "Invalid document type")

    extension = Path(file.filename or "").suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, "Only PDF, JPG, JPEG and PNG allowed")

    if current_user["role"] == "admin":
        if not employee_id or not ObjectId.is_valid(employee_id):
            raise HTTPException(400, "Valid employee ID is required")

        employee = employees.find_one({"_id": ObjectId(employee_id)})

    else:
        employee = employees.find_one({
            "email": current_user["email"]
        })

    if not employee:
        raise HTTPException(404, "Employee not found")

    file_content = await file.read(MAX_FILE_SIZE + 1)

    if not file_content:
        raise HTTPException(400, "Uploaded file is empty")

    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(413, "Maximum file size is 10 MB")

    stored_filename = f"{uuid.uuid4().hex}{extension}"
    file_path = UPLOAD_DIR / stored_filename

    try:
        with open(file_path, "wb") as uploaded_file:
            uploaded_file.write(file_content)

        document_data = {
            "employee_id": employee["_id"],
            "employee_name": employee.get("name", ""),
            "employee_email": employee.get("email", ""),
            "document_type": document_type,
            "file_name": os.path.basename(file.filename or "document"),
            "stored_filename": stored_filename,
            "file_path": str(file_path),
            "upload_date": datetime.now(timezone.utc),
            "uploaded_by": str(current_user["_id"]),
            "ocr_status": "not_started"
        }

        result = documents.insert_one(document_data)

        saved_document = documents.find_one({
            "_id": result.inserted_id
        })

        return {
            "message": "Document uploaded successfully",
            "document": serialize_document(saved_document)
        }

    except Exception:
        if file_path.exists():
            file_path.unlink()

        raise HTTPException(500, "Document upload failed")

    finally:
        await file.close()


@router.get("/")
def get_documents(current_user: dict = Depends(get_current_user)):
    if current_user["role"] == "admin":
        records = documents.find().sort("upload_date", -1)
    else:
        employee = employees.find_one({
            "email": current_user["email"]
        })

        if not employee:
            raise HTTPException(404, "Employee profile not found")

        records = documents.find({
            "employee_id": employee["_id"]
        }).sort("upload_date", -1)

    return [serialize_document(doc) for doc in records]


@router.get("/{document_id}/download")
def download_document(
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(document_id):
        raise HTTPException(400, "Invalid document ID")

    doc = documents.find_one({"_id": ObjectId(document_id)})

    if not doc:
        raise HTTPException(404, "Document not found")

    if current_user["role"] != "admin":
        employee = employees.find_one({
            "email": current_user["email"]
        })

        if not employee or doc["employee_id"] != employee["_id"]:
            raise HTTPException(403, "Access denied")

    file_path = Path(doc["file_path"])

    if not file_path.is_file():
        raise HTTPException(404, "Document file not found")

    return FileResponse(
        path=file_path,
        filename=doc["file_name"]
    )
