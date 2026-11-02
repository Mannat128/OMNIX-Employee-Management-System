
import jwt

from bson import ObjectId
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from database.connection import users
from core.security import JWT_SECRET, JWT_ALGORITHM


security = HTTPBearer()


# Get currently logged-in user
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM]
        )

        user_id = payload.get("sub")

        if not user_id or not ObjectId.is_valid(user_id):
            raise HTTPException(
                status_code=401,
                detail="Invalid token"
            )

        user = users.find_one({
            "_id": ObjectId(user_id)
        })

        if not user:
            raise HTTPException(
                status_code=401,
                detail="User not found"
            )

        # Validate user role
        if user.get("role") not in ["admin", "employee"]:
            raise HTTPException(
                status_code=403,
                detail="Invalid user role"
            )

        # Check employee approval status
        if user.get("role") == "employee":
            if user.get("status") != "approved":
                raise HTTPException(
                    status_code=403,
                    detail="Account pending admin approval"
                )

        return user

    except HTTPException:
        raise

    except (jwt.InvalidTokenError, ValueError, TypeError):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )


# Check Admin Permission
def require_admin(
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    return current_user

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

# Upload configuration
BASE_DIR = Path(__file__).resolve().parents[1]
UPLOAD_DIR = BASE_DIR / "uploads" / "documents"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


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


# Upload document
@router.post("/upload")
async def upload_document(
    document_type: str = Form(...),
    file: UploadFile = File(...),
    employee_id: str = Form(None),
    current_user: dict = Depends(get_current_user)
):
    if document_type not in ["resume", "id", "certificate", "other"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid document type"
        )

    extension = Path(file.filename or "").suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Only PDF, JPG, JPEG and PNG files are allowed"
        )

    # Identify document owner
    if current_user["role"] == "admin":
        if not employee_id or not ObjectId.is_valid(employee_id):
            raise HTTPException(
                status_code=400,
                detail="Valid employee ID is required for admin uploads"
            )

        employee = employees.find_one({
            "_id": ObjectId(employee_id)
        })

        if not employee:
            raise HTTPException(
                status_code=404,
                detail="Employee not found"
            )

    else:
        employee = employees.find_one({
            "email": current_user["email"]
        })

        if not employee:
            raise HTTPException(
                status_code=404,
                detail="Employee profile not found"
            )

    # Read and validate file size
    file_content = await file.read(MAX_FILE_SIZE + 1)

    if not file_content:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty"
        )

    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="File size must not exceed 10 MB"
        )

    # Generate a safe unique filename
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

        raise HTTPException(
            status_code=500,
            detail="Document upload failed"
        )

    finally:
        await file.close()


# Get documents
@router.get("/")
def get_documents(
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] == "admin":
        records = documents.find().sort("upload_date", -1)
    else:
        employee = employees.find_one({
            "email": current_user["email"]
        })

        if not employee:
            raise HTTPException(
                status_code=404,
                detail="Employee profile not found"
            )

        records = documents.find({
            "employee_id": employee["_id"]
        }).sort("upload_date", -1)

    return [
        serialize_document(document)
        for document in records
    ]


# Download document
@router.get("/{document_id}/download")
def download_document(
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(document_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid document ID"
        )

    document = documents.find_one({
        "_id": ObjectId(document_id)
    })

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found"
        )

    if current_user["role"] != "admin":
        employee = employees.find_one({
            "email": current_user["email"]
        })

        if (
            not employee
            or document["employee_id"] != employee["_id"]
        ):
            raise HTTPException(
                status_code=403,
                detail="You cannot access this document"
            )

    file_path = Path(document["file_path"])

    if not file_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Document file not found on server"
        )

    return FileResponse(
        path=file_path,
        filename=document["file_name"]
    )
