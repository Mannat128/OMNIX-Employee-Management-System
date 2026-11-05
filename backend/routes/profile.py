
import uuid
import logging

from pathlib import Path
from datetime import datetime, timezone, date

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    status
)

from pymongo.errors import DuplicateKeyError

from database.connection import client, users, employees

from dependencies.auth import require_password_changed

from models.employee import (
    EmployeeProfileUpdate,
    AdminProfessionalProfileUpdate
)


router = APIRouter()
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent

PROFILE_PHOTO_DIR = BASE_DIR / "uploads" / "profile_photos"

PROFILE_PHOTO_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 2 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png"
}


# ==========================================
# HELPER: GET EMPLOYEE RECORD
# ==========================================

def get_employee_record(user):

    return employees.find_one({
        "user_id": str(user["_id"])
    })


# ==========================================
# HELPER: GET PROFILE PHOTO
# ==========================================

def get_photo_url(user, employee=None):

    if user.get("role") == "admin":
        return user.get("profile_photo")

    if employee:
        return employee.get("profile_photo")

    return None


# ==========================================
# HELPER: SERIALIZE PROFILE
# ==========================================

def serialize_profile(user, employee=None):

    employee = employee or {}

    return {
        "id": str(user["_id"]),
        "name": user.get("name") or employee.get("name"),
        "email": user.get("email") or employee.get("email"),
        "role": user.get("role"),
        "status": user.get("status"),

        # Personal Information
        "phone": employee.get("phone") or user.get("phone"),

        "date_of_birth": (
            employee.get("date_of_birth")
            or user.get("date_of_birth")
        ),

        "gender": employee.get("gender") or user.get("gender"),

        "city": employee.get("city") or user.get("city"),

        "state": employee.get("state") or user.get("state"),

        "profile_photo": get_photo_url(
            user,
            employee
        ),

        # Professional Information
        "employee_id": (
            employee.get("employee_id")
            or user.get("employee_id")
        ),

        "department": (
            user.get("department")
            or employee.get("department")
        ),

        "designation": (
            user.get("designation")
            or employee.get("designation")
        ),

        "joining_date": (
            user.get("joining_date")
            or employee.get("joining_date")
        ),

        "employment_type": (
            user.get("employment_type")
            or employee.get("employment_type")
        ),

        "employment_status": (
            user.get("employment_status")
            or employee.get("employment_status")
        )
    }


# ==========================================
# HELPER: DATE CONVERSION
# ==========================================

def convert_to_date(value):

    if not value:
        return None

    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, date):
        return value

    if isinstance(value, str):

        try:
            return date.fromisoformat(value)

        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format in existing profile"
            )

    return None


# ==========================================
# HELPER: VALIDATE EMPLOYMENT DATES
# ==========================================

def validate_employment_dates(
    date_of_birth,
    joining_date
):

    dob = convert_to_date(date_of_birth)
    joining = convert_to_date(joining_date)

    if dob and joining and joining < dob:

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Joining date cannot be before date of birth"
        )


# ==========================================
# HELPER: REMOVE OLD PHOTO
# ==========================================

def remove_old_photo(photo_url):

    if not photo_url:
        return

    if not isinstance(photo_url, str):
        return

    if not photo_url.startswith(
        "/uploads/profile_photos/"
    ):
        return

    filename = Path(photo_url).name

    if filename in {"", ".", ".."}:
        return

    old_path = PROFILE_PHOTO_DIR / filename

    try:

        if old_path.is_file():
            old_path.unlink()

    except OSError:
        logger.warning(
            "Unable to remove old profile photo"
        )


# ==========================================
# HELPER: VALIDATE PROFILE PHOTO
# ==========================================

def validate_photo_file(
    filename,
    content_type,
    content
):

    extension = Path(filename or "").suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPG, JPEG and PNG images are allowed"
        )

    expected_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png"
    }

    if content_type != expected_types[extension]:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image content type"
        )

    is_jpeg = content.startswith(b"\xff\xd8\xff")
    is_png = content.startswith(b"\x89PNG\r\n\x1a\n")

    if not (
        (extension in {".jpg", ".jpeg"} and is_jpeg)
        or (extension == ".png" and is_png)
    ):

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image file"
        )

    return extension


# ==========================================
# HELPER: GET PROFILE TARGET
# ==========================================

def get_profile_target(current_user):

    role = current_user.get("role")

    if role == "admin":

        return users, current_user["_id"], None

    if role == "employee":

        employee = get_employee_record(current_user)

        if not employee:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee profile not found"
            )

        return employees, employee["_id"], employee

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Invalid account role"
    )


# ==========================================
# GET MY PROFILE
# Admin and Employee
# ==========================================

@router.get("/me")
def get_my_profile(
    current_user: dict = Depends(require_password_changed)
):

    role = current_user.get("role")

    employee = None

    if role == "employee":

        employee = get_employee_record(current_user)

        if not employee:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee profile not found"
            )

    elif role != "admin":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid account role"
        )

    return serialize_profile(
        current_user,
        employee
    )


# ==========================================
# UPDATE MY PERSONAL PROFILE
# Admin and Employee
# ==========================================

@router.patch("/me")
def update_my_profile(
    data: EmployeeProfileUpdate,
    current_user: dict = Depends(require_password_changed)
):

    role = current_user.get("role")

    if role not in {"admin", "employee"}:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid account role"
        )

    update_data = data.model_dump(
        exclude_unset=True,
        exclude_none=True,
        mode="json"
    )

    if not update_data:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No profile details provided"
        )

    employee = None

    if role == "employee":

        employee = get_employee_record(current_user)

        if not employee:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee profile not found"
            )

    # Validate dates against existing profile values.
    dob = update_data.get(
        "date_of_birth",
        employee.get("date_of_birth")
        if employee
        else current_user.get("date_of_birth")
    )

    joining_date = (
        employee.get("joining_date")
        if employee
        else current_user.get("joining_date")
    )

    validate_employment_dates(
        dob,
        joining_date
    )

    # Normalize and validate email.
    if "email" in update_data:

        new_email = str(
            update_data["email"]
        ).lower().strip()

        duplicate_user = users.find_one({
            "email": new_email,
            "_id": {"$ne": current_user["_id"]}
        })

        duplicate_employee = employees.find_one({
            "email": new_email,
            "user_id": {"$ne": str(current_user["_id"])}
        })

        if duplicate_user or duplicate_employee:

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email address is already registered"
            )

        update_data["email"] = new_email

    now = datetime.now(timezone.utc)

    try:

        # ADMIN PROFILE UPDATE
        if role == "admin":

            result = users.update_one(
                {
                    "_id": current_user["_id"]
                },
                {
                    "$set": {
                        **update_data,
                        "updated_at": now
                    }
                }
            )

            if result.matched_count != 1:

                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Admin account not found"
                )

        # EMPLOYEE PROFILE UPDATE
        else:

            user_updates = {}

            if "name" in update_data:
                user_updates["name"] = update_data["name"]

            if "email" in update_data:
                user_updates["email"] = update_data["email"]

            with client.start_session() as session:

                with session.start_transaction():

                    employee_result = employees.update_one(
                        {
                            "_id": employee["_id"]
                        },
                        {
                            "$set": {
                                **update_data,
                                "updated_at": now
                            }
                        },
                        session=session
                    )

                    if employee_result.matched_count != 1:

                        raise HTTPException(
                            status_code=status.HTTP_404_NOT_FOUND,
                            detail="Employee profile not found"
                        )

                    if user_updates:

                        user_result = users.update_one(
                            {
                                "_id": current_user["_id"]
                            },
                            {
                                "$set": {
                                    **user_updates,
                                    "updated_at": now
                                }
                            },
                            session=session
                        )

                        if user_result.matched_count != 1:

                            raise HTTPException(
                                status_code=status.HTTP_404_NOT_FOUND,
                                detail="Login account not found"
                            )

    except DuplicateKeyError:

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email address is already registered"
        )

    except HTTPException:
        raise

    except Exception as error:

        logger.exception("Profile update failed")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to update profile"
        ) from error

    updated_user = users.find_one({
        "_id": current_user["_id"]
    })

    if not updated_user:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Updated account not found"
        )

    updated_employee = None

    if role == "employee":
        updated_employee = get_employee_record(updated_user)

    return {
        "message": "Profile updated successfully",
        "profile": serialize_profile(
            updated_user,
            updated_employee
        )
    }


# ==========================================
# ADMIN: UPDATE OWN PROFESSIONAL INFORMATION
# Admin only
# ==========================================

@router.patch("/me/professional")
def update_admin_professional_profile(
    data: AdminProfessionalProfileUpdate,
    current_user: dict = Depends(require_password_changed)
):

    if current_user.get("role") != "admin":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin can update this information"
        )

    update_data = data.model_dump(
        exclude_unset=True,
        exclude_none=True,
        mode="json"
    )

    if not update_data:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No professional details provided"
        )

    dob = current_user.get("date_of_birth")

    joining_date = update_data.get(
        "joining_date",
        current_user.get("joining_date")
    )

    validate_employment_dates(
        dob,
        joining_date
    )

    try:

        result = users.update_one(
            {
                "_id": current_user["_id"],
                "role": "admin"
            },
            {
                "$set": {
                    **update_data,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )

        if result.matched_count != 1:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Admin account not found"
            )

    except HTTPException:
        raise

    except Exception as error:

        logger.exception(
            "Admin professional profile update failed"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to update professional information"
        ) from error

    updated_user = users.find_one({
        "_id": current_user["_id"]
    })

    return {
        "message": "Admin professional information updated successfully",
        "profile": serialize_profile(updated_user)
    }


# ==========================================
# UPLOAD PROFILE PHOTO
# Admin and Employee
# ==========================================

@router.post("/me/profile-photo")
async def upload_profile_photo(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_password_changed)
):

    role = current_user.get("role")

    if role not in {"admin", "employee"}:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid account role"
        )

    employee = None

    if role == "employee":

        employee = get_employee_record(current_user)

        if not employee:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee profile not found"
            )

    photo_path = None

    try:

        content = await file.read(MAX_FILE_SIZE + 1)

        if not content:

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty"
            )

        if len(content) > MAX_FILE_SIZE:

            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Profile photo must be 2 MB or smaller"
            )

        extension = validate_photo_file(
            file.filename,
            file.content_type,
            content
        )

        unique_filename = f"{uuid.uuid4().hex}{extension}"

        photo_path = PROFILE_PHOTO_DIR / unique_filename

        photo_url = (
            f"/uploads/profile_photos/{unique_filename}"
        )

        old_photo_url = get_photo_url(
            current_user,
            employee
        )

        # Save new photo.
        with open(photo_path, "xb") as photo_file:
            photo_file.write(content)

        target_collection, target_id, _ = get_profile_target(
            current_user
        )

        update_result = target_collection.update_one(
            {
                "_id": target_id
            },
            {
                "$set": {
                    "profile_photo": photo_url,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )

        if update_result.matched_count != 1:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profile record not found"
            )

    except Exception:

        # Remove newly created file if DB update fails.
        if photo_path and photo_path.exists():

            try:
                photo_path.unlink()

            except OSError:
                logger.exception(
                    "Unable to clean up failed photo upload"
                )

        raise

    finally:
        await file.close()

    # Delete old photo only after successful DB update.
    remove_old_photo(old_photo_url)

    updated_user = users.find_one({
        "_id": current_user["_id"]
    })

    if not updated_user:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found after photo upload"
        )

    updated_employee = None

    if role == "employee":
        updated_employee = get_employee_record(updated_user)

    return {
        "message": "Profile photo uploaded successfully",
        "profile": serialize_profile(
            updated_user,
            updated_employee
        )
    }


# ==========================================
# REMOVE PROFILE PHOTO
# Admin and Employee
# ==========================================

@router.delete("/me/profile-photo")
def delete_profile_photo(
    current_user: dict = Depends(require_password_changed)
):

    role = current_user.get("role")

    if role not in {"admin", "employee"}:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid account role"
        )

    employee = None

    if role == "employee":

        employee = get_employee_record(current_user)

        if not employee:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee profile not found"
            )

    old_photo_url = get_photo_url(
        current_user,
        employee
    )

    if not old_photo_url:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No profile photo found"
        )

    target_collection, target_id, _ = get_profile_target(
        current_user
    )

    try:

        update_result = target_collection.update_one(
            {
                "_id": target_id
            },
            {
                "$set": {
                    "profile_photo": None,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )

        if update_result.matched_count != 1:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profile record not found"
            )

    except HTTPException:
        raise

    except Exception as error:

        logger.exception(
            "Profile photo removal failed"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to remove profile photo"
        ) from error

    # Remove file after successful database update.
    remove_old_photo(old_photo_url)

    return {
        "message": "Profile photo removed successfully",
        "profile_photo": None
    }
