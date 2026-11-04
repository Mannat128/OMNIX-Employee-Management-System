
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
    Form,
    BackgroundTasks
)

from fastapi.responses import FileResponse

from database.connection import documents, employees

from dependencies.auth import require_password_changed

from services.ocr_background import process_ocr_background


router = APIRouter()


# Base directories
BASE_DIR = Path(__file__).resolve().parents[1]

UPLOAD_DIR = BASE_DIR / "uploads" / "documents"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# Allowed document formats
ALLOWED_EXTENSIONS = {
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png"
}

MAX_FILE_SIZE = 10 * 1024 * 1024

ALLOWED_DOCUMENT_TYPES = {
    "resume",
    "id",
    "certificate",
    "other"
}


# Validate actual file content
def validate_file_content(extension, file_content):

    if extension == ".pdf":
        return file_content.startswith(b"%PDF-")

    if extension in {".jpg", ".jpeg"}:
        return file_content.startswith(b"\xff\xd8\xff")

    if extension == ".png":
        return file_content.startswith(b"\x89PNG\r\n\x1a\n")

    return False


# Serialize MongoDB document
def serialize_document(document):

    return {
        "id": str(document["_id"]),
        "employee_id": str(document["employee_id"]),
        "employee_name": document.get("employee_name", ""),
        "employee_email": document.get("employee_email", ""),
        "document_type": document["document_type"],
        "custom_document_name": document.get("custom_document_name"),
        "file_name": document["file_name"],
        "upload_date": document["upload_date"].isoformat(),
        "ocr_status": document.get("ocr_status", "not_started"),
        "ocr_error": document.get("ocr_error")
    }


# Get employee profile linked to logged-in user
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


# UPLOAD - Admin and Employee can upload documents
@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    employee_id: str = Form(None),
    custom_document_name: str = Form(None),
    current_user: dict = Depends(require_password_changed)
):

    document_type = document_type.strip().lower()

    if document_type not in ALLOWED_DOCUMENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Invalid document type"
        )

    # Custom name required for ID Proof and Other
    if document_type in {"id", "other"}:
        if not custom_document_name or not custom_document_name.strip():
            raise HTTPException(
                status_code=400,
                detail="Please enter the document name"
            )

        custom_document_name = custom_document_name.strip()

        if len(custom_document_name) > 100:
            raise HTTPException(
                status_code=400,
                detail="Document name cannot exceed 100 characters"
            )

    else:
        custom_document_name = None

    extension = Path(file.filename or "").suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Only PDF, JPG, JPEG and PNG files are allowed"
        )

    # Identify employee
    if current_user["role"] == "admin":

        if not employee_id or not ObjectId.is_valid(employee_id):
            raise HTTPException(
                status_code=400,
                detail="Valid employee ID is required"
            )

        employee = employees.find_one({
            "_id": ObjectId(employee_id)
        })

    elif current_user["role"] == "employee":

        employee = get_employee_profile(current_user)

    else:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee not found"
        )

    file_path = None

    try:

        # Read maximum allowed size + 1 byte
        file_content = await file.read(MAX_FILE_SIZE + 1)

        if not file_content:
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty"
            )

        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail="Maximum file size is 10 MB"
            )

        # Validate actual file signature
        if not validate_file_content(extension, file_content):
            raise HTTPException(
                status_code=400,
                detail="Invalid file content or file extension mismatch"
            )

        # Generate unique stored filename
        stored_filename = f"{uuid.uuid4().hex}{extension}"

        file_path = UPLOAD_DIR / stored_filename

        # Save document
        with open(file_path, "wb") as uploaded_file:
            uploaded_file.write(file_content)

        document_data = {
            "employee_id": employee["_id"],
            "employee_name": employee.get("name", ""),
            "employee_email": employee.get("email", ""),
            "document_type": document_type,
            "custom_document_name": custom_document_name,
            "file_name": os.path.basename(
                file.filename or "document"
            ),
            "stored_filename": stored_filename,
            "file_path": str(file_path),
            "upload_date": datetime.now(timezone.utc),
            "uploaded_by": str(current_user["_id"]),
            "ocr_status": "pending",
            "ocr_error": None
        }

        result = documents.insert_one(document_data)

        saved_document = documents.find_one({
            "_id": result.inserted_id
        })

        # Schedule OCR for every supported document category
        background_tasks.add_task(
            process_ocr_background,
            str(result.inserted_id)
        )

        return {
            "message": "Document uploaded successfully",
            "ocr_message": "OCR processing has been scheduled.",
            "document": serialize_document(saved_document)
        }

    except HTTPException:

        if file_path and file_path.exists():
            file_path.unlink()

        raise

    except Exception as error:

        if file_path and file_path.exists():
            file_path.unlink()

        raise HTTPException(
            status_code=500,
            detail="Document upload failed"
        ) from error

    finally:
        await file.close()


# READ - Admin can view all documents
# Employee can view only their own documents
@router.get("/")
def get_documents(
    current_user: dict = Depends(require_password_changed)
):

    if current_user["role"] == "admin":

        records = documents.find().sort(
            "upload_date",
            -1
        )

    elif current_user["role"] == "employee":

        employee = get_employee_profile(current_user)

        records = documents.find({
            "employee_id": employee["_id"]
        }).sort(
            "upload_date",
            -1
        )

    else:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    return [
        serialize_document(doc)
        for doc in records
    ]


# DOWNLOAD - Admin can download all documents
# Employee can download only their own documents
@router.get("/{document_id}/download")
def download_document(
    document_id: str,
    current_user: dict = Depends(require_password_changed)
):

    if not ObjectId.is_valid(document_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid document ID"
        )

    doc = documents.find_one({
        "_id": ObjectId(document_id)
    })

    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Document not found"
        )

    # Role-based access control
    if current_user["role"] == "employee":

        employee = get_employee_profile(current_user)

        if doc["employee_id"] != employee["_id"]:
            raise HTTPException(
                status_code=403,
                detail="Access denied"
            )

    elif current_user["role"] != "admin":

        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    # Path Traversal Protection
    try:

        file_path = Path(doc["file_path"]).resolve()

        upload_directory = UPLOAD_DIR.resolve()

        if not file_path.is_relative_to(upload_directory):

            raise HTTPException(
                status_code=403,
                detail="Invalid document file path"
            )

    except (OSError, ValueError):

        raise HTTPException(
            status_code=400,
            detail="Invalid document file path"
        )

    if not file_path.is_file():

        raise HTTPException(
            status_code=404,
            detail="Document file not found"
        )

    return FileResponse(
        path=str(file_path),
        filename=doc["file_name"]
    )
