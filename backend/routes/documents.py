
import logging
import uuid

from datetime import datetime, timezone
from pathlib import Path

from bson import ObjectId
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status
)
from fastapi.responses import FileResponse

from database.connection import documents, employees
from dependencies.auth import require_password_changed
from services.ocr_background import process_ocr_background


router = APIRouter()
logger = logging.getLogger(__name__)

# ==========================================
# CONFIGURATION
# ==========================================

BASE_DIR = Path(__file__).resolve().parent.parent
DOCUMENT_UPLOAD_DIR = BASE_DIR / "uploads" / "documents"

DOCUMENT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 10 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png"
}

DOCUMENT_TYPES = {
    "resume",
    "id",
    "certificate",
    "other"
}


# ==========================================
# FILE VALIDATION
# ==========================================

def validate_file_content(extension: str, content: bytes):

    if extension == ".pdf":
        return content.startswith(b"%PDF-")

    if extension in {".jpg", ".jpeg"}:
        return content.startswith(b"\xff\xd8\xff")

    if extension == ".png":
        return content.startswith(b"\x89PNG\r\n\x1a\n")

    return False


# ==========================================
# SAFE DOCUMENT PATH
# Supports new and legacy records
# ==========================================

def get_safe_document_path(document: dict) -> Path:

    base_directory = DOCUMENT_UPLOAD_DIR.resolve()

    stored_filename = document.get("stored_filename")

    # New document format
    if stored_filename:

        safe_name = Path(stored_filename).name

        if safe_name != stored_filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid stored document filename"
            )

        file_path = (base_directory / safe_name).resolve()

    else:
        # Legacy document format
        legacy_path = document.get("file_path")

        if not legacy_path:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document file path not found"
            )

        file_path = Path(legacy_path).resolve()

    # Prevent path traversal and access outside upload directory
    try:
        file_path.relative_to(base_directory)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid document path"
        )

    return file_path


# ==========================================
# SERIALIZE DOCUMENT
# ==========================================

def serialize_document(document):

    uploaded_at = document.get("upload_date")
    created_at = document.get("created_at")

    return {
        "id": str(document["_id"]),
        "employee_id": str(document.get("employee_id", "")),
        "user_id": document.get("user_id"),
        "employee_name": document.get("employee_name", ""),
        "employee_email": document.get("employee_email", ""),
        "document_type": document.get("document_type", "other"),
        "custom_document_name": document.get("custom_document_name"),
        "file_name": document.get("file_name", ""),
        "file_size": document.get("file_size", 0),
        "file_type": document.get("file_type", ""),
        "ocr_status": document.get("ocr_status", "pending"),
        "ocr_error": document.get("ocr_error"),
        "upload_date": (
            uploaded_at.isoformat()
            if isinstance(uploaded_at, datetime)
            else None
        ),
        "created_at": (
            created_at.isoformat()
            if isinstance(created_at, datetime)
            else None
        )
    }


# ==========================================
# GET EMPLOYEE PROFILE
# ==========================================

def get_employee_for_user(current_user):

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
# UPLOAD DOCUMENT
# ==========================================

@router.post(
    "/upload",
    status_code=status.HTTP_201_CREATED
)
async def upload_document(
    background_tasks: BackgroundTasks,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    employee_id: str | None = Form(None),
    custom_document_name: str | None = Form(None),
    current_user: dict = Depends(require_password_changed)
):

    file_path = None
    database_inserted = False

    try:

        # --------------------------------------
        # Validate document category
        # --------------------------------------

        if document_type not in DOCUMENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid document type"
            )

        if document_type in {"id", "other"}:

            if not custom_document_name or not custom_document_name.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Document name is required for ID and Other documents"
                )

            custom_document_name = custom_document_name.strip()

            if len(custom_document_name) > 100:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Document name cannot exceed 100 characters"
                )

        else:
            custom_document_name = None

        # --------------------------------------
        # Resolve employee access
        # --------------------------------------

        if current_user["role"] == "admin":

            if not employee_id or not ObjectId.is_valid(employee_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A valid employee ID is required"
                )

            employee = employees.find_one({
                "_id": ObjectId(employee_id)
            })

            if not employee:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Employee not found"
                )

        elif current_user["role"] == "employee":

            employee = get_employee_for_user(current_user)

        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        # --------------------------------------
        # Validate employee status
        # --------------------------------------

        if employee.get("employment_status", "Active") != "Active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Documents cannot be uploaded for an inactive employee"
            )

        # --------------------------------------
        # Validate file extension
        # --------------------------------------

        original_filename = Path(file.filename or "").name
        extension = Path(original_filename).suffix.lower()

        if not original_filename or extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PDF, JPG, JPEG and PNG files are allowed"
            )

        # --------------------------------------
        # Read bounded file content
        # --------------------------------------

        file_content = await file.read(MAX_FILE_SIZE + 1)

        if not file_content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty"
            )

        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File size must not exceed 10 MB"
            )

        if not validate_file_content(extension, file_content):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File content does not match the selected file format"
            )

        # --------------------------------------
        # Save using generated filename
        # --------------------------------------

        stored_filename = f"{uuid.uuid4().hex}{extension}"
        file_path = DOCUMENT_UPLOAD_DIR / stored_filename

        try:
            with open(file_path, "xb") as output_file:
                output_file.write(file_content)

        except OSError as error:
            logger.exception("Unable to save uploaded document")

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unable to save document"
            ) from error

        # --------------------------------------
        # Prepare database document
        # --------------------------------------

        now = datetime.now(timezone.utc)

        document_data = {
            "employee_id": employee["_id"],
            "user_id": employee.get("user_id"),
            "employee_name": employee.get("name", ""),
            "employee_email": employee.get("email", ""),
            "document_type": document_type,
            "custom_document_name": custom_document_name,
            "file_name": original_filename,
            "stored_filename": stored_filename,
            "file_path": str(file_path.resolve()),
            "file_size": len(file_content),
            "file_type": extension.lstrip("."),
            "ocr_status": "pending",
            "ocr_error": None,
            "upload_date": now,
            "created_at": now
        }

        # --------------------------------------
        # Save metadata
        # --------------------------------------

        try:
            insert_result = documents.insert_one(document_data)
            database_inserted = True

        except Exception as error:
            logger.exception("Unable to save document metadata")

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unable to save document information"
            ) from error

        # --------------------------------------
        # Schedule OCR
        # --------------------------------------

        try:
            background_tasks.add_task(
                process_ocr_background,
                str(insert_result.inserted_id)
            )

        except Exception as error:

            logger.exception(
                "Unable to schedule OCR for document %s",
                insert_result.inserted_id
            )

            documents.update_one(
                {"_id": insert_result.inserted_id},
                {
                    "$set": {
                        "ocr_status": "failed",
                        "ocr_error": "OCR could not be scheduled"
                    }
                }
            )

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Document uploaded but OCR could not be scheduled"
            ) from error

        return {
            "message": (
                "Document uploaded successfully. "
                "OCR processing has been scheduled."
            ),
            "document": serialize_document({
                **document_data,
                "_id": insert_result.inserted_id
            })
        }

    except Exception:
        # Clean up only when database metadata was not saved.
        if file_path and file_path.exists() and not database_inserted:
            try:
                file_path.unlink()
            except OSError:
                logger.exception("Unable to clean up uploaded document")

        raise

    finally:
        await file.close()


# ==========================================
# GET DOCUMENTS
# Admin: All documents
# Employee: Own documents only
# ==========================================

@router.get("/")
def get_documents(
    current_user: dict = Depends(require_password_changed)
):

    if current_user["role"] == "admin":

        query = {}

    elif current_user["role"] == "employee":

        employee = get_employee_for_user(current_user)

        query = {
            "employee_id": employee["_id"]
        }

    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    results = documents.find(query).sort(
        "upload_date",
        -1
    )

    return [
        serialize_document(document)
        for document in results
    ]


# ==========================================
# DOWNLOAD DOCUMENT
# ==========================================

@router.get("/{document_id}/download")
def download_document(
    document_id: str,
    current_user: dict = Depends(require_password_changed)
):

    if not ObjectId.is_valid(document_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid document ID"
        )

    document = documents.find_one({
        "_id": ObjectId(document_id)
    })

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # --------------------------------------
    # Employee ownership check
    # --------------------------------------

    if current_user["role"] == "employee":

        employee = get_employee_for_user(current_user)

        if document.get("employee_id") != employee["_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You cannot download another employee's document"
            )

    elif current_user["role"] != "admin":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # --------------------------------------
    # Resolve safe stored path
    # --------------------------------------

    file_path = get_safe_document_path(document)

    if not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Original document file not found"
        )

    return FileResponse(
        path=str(file_path),
        filename=Path(document.get("file_name", "document")).name,
        media_type="application/octet-stream"
    )
