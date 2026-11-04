
import os
import uuid

from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File
)

from pymongo.errors import DuplicateKeyError

from database.connection import users, employees

from dependencies.auth import require_password_changed

from models.employee import (
    EmployeeProfileUpdate,
    AdminProfessionalProfileUpdate
)


router = APIRouter()


# ==========================================
# PROFILE PHOTO DIRECTORY
# ==========================================

BASE_DIR = os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))
)

PROFILE_PHOTO_DIR = os.path.join(
    BASE_DIR,
    "uploads",
    "profile_photos"
)

os.makedirs(PROFILE_PHOTO_DIR, exist_ok=True)

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
        "phone": employee.get(
            "phone",
            user.get("phone")
        ),

        "date_of_birth": employee.get(
            "date_of_birth",
            user.get("date_of_birth")
        ),

        "gender": employee.get(
            "gender",
            user.get("gender")
        ),

        "city": employee.get(
            "city",
            user.get("city")
        ),

        "state": employee.get(
            "state",
            user.get("state")
        ),

        "profile_photo": get_photo_url(
            user,
            employee
        ),

        # Professional Information
        "employee_id": employee.get(
            "employee_id",
            user.get("employee_id")
        ),

        "department": user.get(
            "department",
            employee.get("department")
        ),

        "designation": user.get(
            "designation",
            employee.get("designation")
        ),

        "joining_date": user.get(
            "joining_date",
            employee.get("joining_date")
        ),

        "employment_type": user.get(
            "employment_type",
            employee.get("employment_type")
        ),

        "employment_status": user.get(
            "employment_status",
            employee.get("employment_status")
        )
    }


# ==========================================
# HELPER: REMOVE OLD PHOTO
# ==========================================

def remove_old_photo(photo_url):

    if not photo_url:
        return

    if not photo_url.startswith(
        "/uploads/profile_photos/"
    ):
        return

    filename = os.path.basename(photo_url)

    old_path = os.path.join(
        PROFILE_PHOTO_DIR,
        filename
    )

    if os.path.isfile(old_path):

        try:
            os.remove(old_path)

        except OSError:
            pass


# ==========================================
# GET MY PROFILE
# Employee/Admin can view own profile
# ==========================================

@router.get("/me")
def get_my_profile(
    current_user: dict = Depends(require_password_changed)
):

    employee = None

    if current_user.get("role") == "employee":

        employee = get_employee_record(current_user)

        if not employee:

            raise HTTPException(
                status_code=404,
                detail="Employee profile not found"
            )

    return serialize_profile(
        current_user,
        employee
    )


# ==========================================
# UPDATE MY PERSONAL PROFILE
# Employee/Admin can update own details
# ==========================================

@router.patch("/me")
def update_my_profile(
    data: EmployeeProfileUpdate,
    current_user: dict = Depends(require_password_changed)
):

    update_data = data.model_dump(
        exclude_unset=True,
        exclude_none=True,
        mode="json"
    )

    if not update_data:

        raise HTTPException(
            status_code=400,
            detail="No profile details provided"
        )

    role = current_user.get("role")

    employee = None

    if role == "employee":

        employee = get_employee_record(current_user)

        if not employee:

            raise HTTPException(
                status_code=404,
                detail="Employee profile not found"
            )

    # Check duplicate email
    new_email = update_data.get("email")

    if new_email:

        new_email = str(new_email).lower().strip()

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
                status_code=409,
                detail="Email address is already registered"
            )

        update_data["email"] = new_email

    # Admin personal information
    if role == "admin":

        try:

            users.update_one(
                {"_id": current_user["_id"]},
                {
                    "$set": {
                        **update_data,
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )

        except DuplicateKeyError:

            raise HTTPException(
                status_code=409,
                detail="Email address is already registered"
            )

    # Employee personal information
    elif role == "employee":

        user_updates = {}

        if "name" in update_data:
            user_updates["name"] = update_data["name"]

        if "email" in update_data:
            user_updates["email"] = update_data["email"]

        try:

            with users.database.client.start_session() as session:

                with session.start_transaction():

                    employees.update_one(
                        {"_id": employee["_id"]},
                        {
                            "$set": {
                                **update_data,
                                "updated_at": datetime.now(timezone.utc)
                            }
                        },
                        session=session
                    )

                    if user_updates:

                        users.update_one(
                            {"_id": current_user["_id"]},
                            {
                                "$set": {
                                    **user_updates,
                                    "updated_at": datetime.now(timezone.utc)
                                }
                            },
                            session=session
                        )

        except DuplicateKeyError:

            raise HTTPException(
                status_code=409,
                detail="Email address is already registered"
            )

    else:

        raise HTTPException(
            status_code=403,
            detail="Invalid account role"
        )

    updated_user = users.find_one({
        "_id": current_user["_id"]
    })

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
            status_code=403,
            detail="Only Admin can update this information"
        )

    update_data = data.model_dump(
        exclude_unset=True,
        exclude_none=True,
        mode="json"
    )

    if not update_data:

        raise HTTPException(
            status_code=400,
            detail="No professional details provided"
        )

    # Validate dates when both dates are available
    date_of_birth = current_user.get("date_of_birth")
    joining_date = update_data.get("joining_date")

    if joining_date and date_of_birth:

        if isinstance(date_of_birth, str):
            date_of_birth = datetime.fromisoformat(
                date_of_birth
            ).date()

        if isinstance(date_of_birth, datetime):
            date_of_birth = date_of_birth.date()

        if isinstance(joining_date, str):
            joining_date = datetime.fromisoformat(
                joining_date
            ).date()

        if joining_date < date_of_birth:

            raise HTTPException(
                status_code=422,
                detail="Joining date cannot be before date of birth"
            )

    users.update_one(
        {"_id": current_user["_id"]},
        {
            "$set": {
                **update_data,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )

    updated_user = users.find_one({
        "_id": current_user["_id"]
    })

    return {
        "message": "Admin professional information updated successfully",
        "profile": serialize_profile(updated_user)
    }


# ==========================================
# UPLOAD PROFILE PHOTO
# Employee/Admin can upload own photo
# ==========================================

@router.post("/me/profile-photo")
async def upload_profile_photo(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_password_changed)
):

    role = current_user.get("role")

    employee = None

    if role == "employee":

        employee = get_employee_record(current_user)

        if not employee:

            raise HTTPException(
                status_code=404,
                detail="Employee profile not found"
            )

    extension = os.path.splitext(
        file.filename or ""
    )[1].lower()

    if extension not in ALLOWED_EXTENSIONS:

        raise HTTPException(
            status_code=400,
            detail="Only JPG, JPEG and PNG images are allowed"
        )

    if file.content_type not in {
        "image/jpeg",
        "image/png"
    }:

        raise HTTPException(
            status_code=400,
            detail="Invalid image content type"
        )

    photo_path = None

    try:

        file_content = await file.read(
            MAX_FILE_SIZE + 1
        )

        if not file_content:

            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty"
            )

        if len(file_content) > MAX_FILE_SIZE:

            raise HTTPException(
                status_code=413,
                detail="Profile photo must be 2 MB or smaller"
            )

        is_jpeg = file_content.startswith(
            b"\xff\xd8\xff"
        )

        is_png = file_content.startswith(
            b"\x89PNG\r\n\x1a\n"
        )

        if not (
            (extension in {".jpg", ".jpeg"} and is_jpeg)
            or (extension == ".png" and is_png)
        ):

            raise HTTPException(
                status_code=400,
                detail="Invalid image file"
            )

        unique_filename = (
            f"{uuid.uuid4().hex}{extension}"
        )

        photo_path = os.path.join(
            PROFILE_PHOTO_DIR,
            unique_filename
        )

        photo_url = (
            f"/uploads/profile_photos/{unique_filename}"
        )

        with open(photo_path, "wb") as photo_file:
            photo_file.write(file_content)

        if role == "admin":

            users.update_one(
                {"_id": current_user["_id"]},
                {
                    "$set": {
                        "profile_photo": photo_url,
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )

        elif role == "employee":

            employees.update_one(
                {"_id": employee["_id"]},
                {
                    "$set": {
                        "profile_photo": photo_url,
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )

        else:

            raise HTTPException(
                status_code=403,
                detail="Invalid account role"
            )

        remove_old_photo(
            get_photo_url(current_user, employee)
        )

    except Exception:

        if photo_path and os.path.exists(photo_path):
            os.remove(photo_path)

        raise

    finally:

        await file.close()

    updated_user = users.find_one({
        "_id": current_user["_id"]
    })

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
# Employee/Admin can remove own photo
# ==========================================

@router.delete("/me/profile-photo")
def delete_profile_photo(
    current_user: dict = Depends(require_password_changed)
):

    role = current_user.get("role")

    employee = None

    if role == "employee":

        employee = get_employee_record(current_user)

        if not employee:

            raise HTTPException(
                status_code=404,
                detail="Employee profile not found"
            )

    old_photo_url = get_photo_url(
        current_user,
        employee
    )

    if not old_photo_url:

        raise HTTPException(
            status_code=404,
            detail="No profile photo found"
        )

    if role == "admin":

        users.update_one(
            {"_id": current_user["_id"]},
            {
                "$set": {
                    "profile_photo": None,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )

    elif role == "employee":

        employees.update_one(
            {"_id": employee["_id"]},
            {
                "$set": {
                    "profile_photo": None,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )

    remove_old_photo(old_photo_url)

    return {
        "message": "Profile photo removed successfully",
        "profile_photo": None
    }
