
import re
import uuid

from pathlib import Path
from typing import Literal

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    UploadFile,
    File,
    Query
)

from fastapi.responses import FileResponse

from dependencies.auth import (
    require_password_changed,
    require_admin
)

from models.ticket import (
    TicketCreate,
    TicketUpdate,
    TicketReply
)

from services.ticket_service import (
    create_ticket,
    get_tickets,
    get_ticket_by_id,
    update_ticket,
    add_ticket_reply,
    add_ticket_attachment,
    get_ticket_attachment,
    filter_admin_tickets,
    get_ticket_statistics
)


router = APIRouter()


# ==========================================
# TICKET UPLOAD CONFIGURATION
# ==========================================

BASE_DIR = Path(__file__).resolve().parents[1]

UPLOAD_DIR = BASE_DIR / "uploads" / "tickets"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png"
}

MAX_FILE_SIZE = 10 * 1024 * 1024

CONTENT_TYPES = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png"
}

STORED_FILENAME_PATTERN = re.compile(
    r"^[a-f0-9]{32}\.(pdf|jpg|jpeg|png)$"
)


# ==========================================
# VALIDATE ACTUAL FILE CONTENT
# ==========================================

def validate_file_content(extension, file_content):

    if extension == ".pdf":
        return file_content.startswith(b"%PDF-")

    if extension in {".jpg", ".jpeg"}:
        return file_content.startswith(b"\xff\xd8\xff")

    if extension == ".png":
        return file_content.startswith(
            b"\x89PNG\r\n\x1a\n"
        )

    return False


# ==========================================
# SAFE FILE CLEANUP
# ==========================================

def cleanup_uploaded_file(file_path):

    if file_path and file_path.exists():

        try:
            file_path.unlink()

        except OSError:
            pass


# ==========================================
# CREATE TICKET
# Employee can raise a support ticket
# Automatically assigned to Admin
# ==========================================

@router.post(
    "/",
    status_code=status.HTTP_201_CREATED
)
def raise_ticket(
    ticket_data: TicketCreate,
    current_user: dict = Depends(require_password_changed)
):

    if current_user.get("role") != "employee":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only employees can raise support tickets"
        )

    try:

        ticket = create_ticket(
            ticket_data,
            current_user
        )

        return {
            "message": "Support ticket created successfully",
            "ticket": ticket
        }

    except ValueError as error:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error)
        ) from error


# ==========================================
# GET ALL TICKETS
# Admin: All tickets
# Employee: Own tickets
# ==========================================

@router.get("/")
def list_tickets(
    current_user: dict = Depends(require_password_changed)
):

    return get_tickets(current_user)


# ==========================================
# ADMIN TICKET FILTERING AND SEARCH
# Admin only
# ==========================================

@router.get("/admin/filter")
def admin_filter_tickets(

    status_filter: Literal[
        "Open",
        "In Progress",
        "Resolved",
        "Closed"
    ] | None = Query(
        default=None,
        alias="status"
    ),

    priority: Literal[
        "Low",
        "Medium",
        "High",
        "Urgent"
    ] | None = None,

    category: Literal[
        "Technical",
        "Documents",
        "Profile",
        "Account",
        "Other"
    ] | None = None,

    search: str | None = Query(
        default=None,
        min_length=1,
        max_length=100
    ),

    sort_order: Literal[
        "newest",
        "oldest"
    ] = "newest",

    page: int = Query(
        default=1,
        ge=1
    ),

    page_size: int = Query(
        default=10,
        ge=1,
        le=100
    ),

    current_user: dict = Depends(require_admin)
):

    return filter_admin_tickets(
        status=status_filter,
        priority=priority,
        category=category,
        search=search,
        sort_order=sort_order,
        page=page,
        page_size=page_size
    )


# ==========================================
# ADMIN DASHBOARD STATISTICS
# Admin only
# ==========================================

@router.get("/admin/statistics")
def admin_ticket_statistics(
    current_user: dict = Depends(require_admin)
):

    return get_ticket_statistics()


# ==========================================
# GET SINGLE TICKET
# ==========================================

@router.get("/{ticket_id}")
def ticket_details(
    ticket_id: str,
    current_user: dict = Depends(require_password_changed)
):

    ticket = get_ticket_by_id(
        ticket_id,
        current_user
    )

    if not ticket:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )

    return ticket


# ==========================================
# UPDATE TICKET
# Admin only
# Tracks status and priority changes
# ==========================================

@router.patch("/{ticket_id}")
def modify_ticket(
    ticket_id: str,
    update_data: TicketUpdate,
    current_user: dict = Depends(require_admin)
):

    ticket = update_ticket(
        ticket_id,
        update_data,
        current_user
    )

    if not ticket:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found or no valid updates provided"
        )

    return {
        "message": "Ticket updated successfully",
        "ticket": ticket
    }


# ==========================================
# REPLY TO TICKET
# Employee and Admin
# ==========================================

@router.post("/{ticket_id}/replies")
def reply_to_ticket(
    ticket_id: str,
    reply_data: TicketReply,
    current_user: dict = Depends(require_password_changed)
):

    try:

        ticket = add_ticket_reply(
            ticket_id,
            reply_data,
            current_user
        )

        if not ticket:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket not found or access denied"
            )

        return {
            "message": "Reply added successfully",
            "ticket": ticket
        }

    except ValueError as error:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error)
        ) from error


# ==========================================
# UPLOAD TICKET ATTACHMENT
# Employee: Own ticket
# Admin: Any ticket
# ==========================================

@router.post("/{ticket_id}/attachments")
async def upload_ticket_attachment(
    ticket_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_password_changed)
):

    file_path = None

    try:

        # Sanitize original filename
        original_filename = Path(
            (file.filename or "").replace("\\", "/")
        ).name

        if not original_filename or original_filename in {".", ".."}:

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A valid filename is required"
            )

        extension = Path(
            original_filename
        ).suffix.lower()

        if extension not in ALLOWED_EXTENSIONS:

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PDF, JPG, JPEG and PNG files are allowed"
            )

        # Read maximum allowed size + 1 byte
        file_content = await file.read(
            MAX_FILE_SIZE + 1
        )

        if not file_content:

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty"
            )

        if len(file_content) > MAX_FILE_SIZE:

            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Maximum file size is 10 MB"
            )

        # Validate actual file signature
        if not validate_file_content(
            extension,
            file_content
        ):

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file content or extension mismatch"
            )

        attachment_id = uuid.uuid4().hex

        stored_filename = (
            f"{uuid.uuid4().hex}{extension}"
        )

        file_path = UPLOAD_DIR / stored_filename

        # Save file using generated filename
        with open(file_path, "xb") as uploaded_file:

            uploaded_file.write(file_content)

        attachment_data = {
            "attachment_id": attachment_id,
            "file_name": original_filename,
            "stored_filename": stored_filename,
            "content_type": CONTENT_TYPES[extension],
            "size": len(file_content)
        }

        # Save attachment metadata in MongoDB
        ticket = add_ticket_attachment(
            ticket_id,
            attachment_data,
            current_user
        )

        if not ticket:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket not found or access denied"
            )

        return {
            "message": "Attachment uploaded successfully",
            "ticket": ticket
        }

    except HTTPException:

        cleanup_uploaded_file(file_path)
        raise

    except ValueError as error:

        cleanup_uploaded_file(file_path)

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error)
        ) from error

    except Exception as error:

        cleanup_uploaded_file(file_path)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Attachment upload failed"
        ) from error

    finally:

        await file.close()


# ==========================================
# DOWNLOAD TICKET ATTACHMENT
# Employee: Own ticket
# Admin: All tickets
# ==========================================

@router.get(
    "/{ticket_id}/attachments/{attachment_id}"
)
def download_ticket_attachment(
    ticket_id: str,
    attachment_id: str,
    current_user: dict = Depends(require_password_changed)
):

    attachment = get_ticket_attachment(
        ticket_id,
        attachment_id,
        current_user
    )

    if not attachment:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found or access denied"
        )

    stored_filename = attachment.get("stored_filename")

    # Only allow filenames generated by this application
    if (
        not isinstance(stored_filename, str)
        or not STORED_FILENAME_PATTERN.fullmatch(stored_filename)
    ):

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid attachment filename"
        )

    extension = Path(stored_filename).suffix.lower()

    expected_content_type = CONTENT_TYPES.get(extension)

    if attachment.get("content_type") != expected_content_type:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid attachment content type"
        )

    try:

        upload_directory = UPLOAD_DIR.resolve()

        file_path = (
            upload_directory / stored_filename
        ).resolve()

        if not file_path.is_relative_to(upload_directory):

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid attachment file path"
            )

    except (OSError, ValueError) as error:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid attachment file path"
        ) from error

    if not file_path.is_file():

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment file not found"
        )

    original_filename = Path(
        str(attachment.get("file_name", "attachment")).replace("\\", "/")
    ).name

    return FileResponse(
        path=str(file_path),
        filename=original_filename,
        media_type=expected_content_type,
        headers={
            "X-Content-Type-Options": "nosniff"
        }
    )
