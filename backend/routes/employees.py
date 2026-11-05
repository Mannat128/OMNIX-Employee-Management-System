
import logging
import secrets
import string
import uuid

from datetime import datetime, timezone
from pathlib import Path

from bson import ObjectId
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    status
)
from pymongo.errors import DuplicateKeyError

from database.connection import client, employees, users
from models.employee import (
    EmployeeCreate,
    EmployeeUpdate,
    EmployeeProfileUpdate
)
from dependencies.auth import (
    require_admin,
    require_password_changed
)
from core.security import hash_password
from core.employee_id import generate_employee_id


router = APIRouter()
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
PROFILE_PHOTO_DIR = BASE_DIR / "uploads" / "profile_photos"
PROFILE_PHOTO_DIR.mkdir(parents=True, exist_ok=True)

MAX_PROFILE_PHOTO_SIZE = 2 * 1024 * 1024

ALLOWED_PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png"}


# ==========================================
# HELPERS
# ==========================================

def generate_temporary_password():
    letters = string.ascii_letters
    numbers = string.digits
    symbols = "!@#$%&*"
    all_characters = letters + numbers + symbols

    password_characters = [
        secrets.choice(letters),
        secrets.choice(numbers),
        secrets.choice(symbols)
    ]

    password_characters.extend(
        secrets.choice(all_characters) for _ in range(9)
    )

    secrets.SystemRandom().shuffle(password_characters)
    return "".join(password_characters)


def serialize_employee(employee):
    if not employee:
        return None

    return {
        "id": str(employee["_id"]),
        "employee_id": employee.get("employee_id"),
        "user_id": employee.get("user_id"),
        "name": employee.get("name", ""),
        "email": employee.get("email", ""),
        "department": employee.get("department", ""),
        "phone": employee.get("phone"),
        "date_of_birth": employee.get("date_of_birth"),
        "gender": employee.get("gender"),
        "city": employee.get("city"),
        "state": employee.get("state"),
        "designation": employee.get("designation"),
        "joining_date": employee.get("joining_date"),
        "employment_type": employee.get("employment_type"),
        "employment_status": employee.get("employment_status", "Active"),
        "profile_photo": employee.get("profile_photo")
    }


def get_linked_user(employee):
    user_id = employee.get("user_id")

    if not user_id or not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=409,
            detail="Employee login account is not linked"
        )

    linked_user = users.find_one({
        "_id": ObjectId(user_id),
        "role": "employee"
    })

    if not linked_user:
        raise HTTPException(
            status_code=409,
            detail="Linked employee account not found"
        )

    return linked_user


def get_employee_or_404(employee_id):
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

    return employee


def safe_delete_file(file_path):
    if file_path:
        try:
            Path(file_path).unlink(missing_ok=True)
        except OSError:
            logger.warning("Unable to remove file: %s", file_path)


def validate_dates(update_data, employee=None):
    employee = employee or {}

    dob = update_data.get(
        "date_of_birth",
        employee.get("date_of_birth")
    )

    joining_date = update_data.get(
        "joining_date",
        employee.get("joining_date")
    )

    if dob and joining_date and joining_date < dob:
        raise HTTPException(
            status_code=400,
            detail="Joining date cannot be before date of birth"
        )


# ==========================================
# CREATE EMPLOYEE
# Admin only
# ==========================================

@router.post("/", status_code=status.HTTP_201_CREATED)
def add_employee(
    data: EmployeeCreate,
    current_user: dict = Depends(require_admin)
):
    email = str(data.email).strip().lower()

    if users.find_one({"email": email}) or employees.find_one({"email": email}):
        raise HTTPException(
            status_code=409,
            detail="Employee email already exists"
        )

    temporary_password = generate_temporary_password()
    now = datetime.now(timezone.utc)

    employee_data = data.model_dump(mode="json")
    employee_data.update({
        "email": email,
        "profile_photo": None,
        "employment_status": "Active",
        "created_at": now,
        "updated_at": now
    })

    user_data = {
        "name": employee_data["name"],
        "email": email,
        "password": hash_password(temporary_password),
        "role": "employee",
        "status": "approved",
        "department": employee_data["department"],
        "mustChangePassword": True,
        "session_version": 0,
        "created_at": now,
        "updated_at": now
    }

    try:
        with client.start_session() as session:
            with session.start_transaction():

                # Generate the ID inside the same transaction.
                employee_data["employee_id"] = generate_employee_id(
                    session=session
                )

                user_result = users.insert_one(
                    user_data,
                    session=session
                )

                employee_data["user_id"] = str(user_result.inserted_id)

                employee_result = employees.insert_one(
                    employee_data,
                    session=session
                )

        created_employee = employees.find_one({
            "_id": employee_result.inserted_id
        })

        return {
            "message": "Employee created successfully",
            "employee": serialize_employee(created_employee),
            "temporary_password": temporary_password,
            "mustChangePassword": True
        }

    except DuplicateKeyError as error:
        raise HTTPException(
            status_code=409,
            detail="Employee email or ID already exists"
        ) from error

    except Exception as error:
        logger.exception("Employee creation failed")
        raise HTTPException(
            status_code=500,
            detail="Unable to create employee"
        ) from error


# ==========================================
# GET ALL EMPLOYEES
# Admin only
# ==========================================

@router.get("/")
def get_all_employees(
    current_user: dict = Depends(require_admin)
):
    all_employees = employees.find().sort("created_at", -1)

    return [
        serialize_employee(employee)
        for employee in all_employees
    ]


# ==========================================
# GET MY PROFILE
# Employee only
# ==========================================

@router.get("/me")
def get_my_employee_profile(
    current_user: dict = Depends(require_password_changed)
):
    if current_user.get("role") != "employee":
        raise HTTPException(
            status_code=403,
            detail="Employee access required"
        )

    employee = employees.find_one({
        "user_id": str(current_user["_id"])
    })

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee profile not found"
        )

    return serialize_employee(employee)


# ==========================================
# UPDATE MY PROFILE
# Employee only
# ==========================================

@router.patch("/me")
def update_my_employee_profile(
    data: EmployeeProfileUpdate,
    current_user: dict = Depends(require_password_changed)
):
    if current_user.get("role") != "employee":
        raise HTTPException(
            status_code=403,
            detail="Employee access required"
        )

    employee = employees.find_one({
        "user_id": str(current_user["_id"])
    })

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee profile not found"
        )

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

    if "email" in update_data:
        update_data["email"] = str(update_data["email"]).strip().lower()

    validate_dates(update_data, employee)

    user_updates = {}

    if "name" in update_data:
        user_updates["name"] = update_data["name"]

    if "email" in update_data:
        user_updates["email"] = update_data["email"]

    now = datetime.now(timezone.utc)

    try:
        with client.start_session() as session:
            with session.start_transaction():

                if "email" in update_data:
                    new_email = update_data["email"]

                    duplicate_user = users.find_one({
                        "email": new_email,
                        "_id": {"$ne": current_user["_id"]}
                    }, session=session)

                    duplicate_employee = employees.find_one({
                        "email": new_email,
                        "_id": {"$ne": employee["_id"]}
                    }, session=session)

                    if duplicate_user or duplicate_employee:
                        raise HTTPException(
                            status_code=409,
                            detail="Email already exists"
                        )

                employees.update_one(
                    {"_id": employee["_id"]},
                    {"$set": {
                        **update_data,
                        "updated_at": now
                    }},
                    session=session
                )

                if user_updates:
                    users.update_one(
                        {"_id": current_user["_id"]},
                        {"$set": {
                            **user_updates,
                            "updated_at": now
                        }},
                        session=session
                    )

        updated_employee = employees.find_one({
            "_id": employee["_id"]
        })

        return {
            "message": "Profile updated successfully",
            "employee": serialize_employee(updated_employee)
        }

    except DuplicateKeyError as error:
        raise HTTPException(
            status_code=409,
            detail="Email already exists"
        ) from error


# ==========================================
# UPLOAD MY PROFILE PHOTO
# Employee only
# ==========================================

@router.post("/me/profile-photo")
async def upload_my_profile_photo(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_password_changed)
):
    if current_user.get("role") != "employee":
        raise HTTPException(
            status_code=403,
            detail="Employee access required"
        )

    employee = employees.find_one({
        "user_id": str(current_user["_id"])
    })

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee profile not found"
        )

    photo_path = None

    try:
        original_filename = Path(
            (file.filename or "").replace("\\", "/")
        ).name

        extension = Path(original_filename).suffix.lower()

        if extension not in ALLOWED_PHOTO_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail="Only JPG, JPEG and PNG images are allowed"
            )

        content = await file.read(MAX_PROFILE_PHOTO_SIZE + 1)

        if not content:
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty"
            )

        if len(content) > MAX_PROFILE_PHOTO_SIZE:
            raise HTTPException(
                status_code=413,
                detail="Profile photo must be 2 MB or smaller"
            )

        is_jpeg = content.startswith(b"\xff\xd8\xff")
        is_png = content.startswith(b"\x89PNG\r\n\x1a\n")

        if not (
            (extension in {".jpg", ".jpeg"} and is_jpeg)
            or (extension == ".png" and is_png)
        ):
            raise HTTPException(
                status_code=400,
                detail="Invalid image file"
            )

        unique_filename = f"{uuid.uuid4().hex}{extension}"
        photo_path = PROFILE_PHOTO_DIR / unique_filename
        photo_url = f"/uploads/profile_photos/{unique_filename}"

        with open(photo_path, "xb") as photo_file:
            photo_file.write(content)

        update_result = employees.update_one(
            {"_id": employee["_id"]},
            {"$set": {
                "profile_photo": photo_url,
                "updated_at": datetime.now(timezone.utc)
            }}
        )

        if update_result.matched_count != 1:
            raise HTTPException(
                status_code=404,
                detail="Employee profile not found"
            )

    except Exception:
        safe_delete_file(photo_path)
        raise

    finally:
        await file.close()

    old_photo_url = employee.get("profile_photo")

    if old_photo_url and old_photo_url.startswith(
        "/uploads/profile_photos/"
    ):
        old_filename = Path(old_photo_url).name

        if old_filename != unique_filename:
            safe_delete_file(PROFILE_PHOTO_DIR / old_filename)

    updated_employee = employees.find_one({
        "_id": employee["_id"]
    })

    return {
        "message": "Profile photo uploaded successfully",
        "profile_photo": photo_url,
        "employee": serialize_employee(updated_employee)
    }


# ==========================================
# GET EMPLOYEE BY ID
# Admin: Any employee
# Employee: Own profile only
# ==========================================

@router.get("/{employee_id}")
def get_employee(
    employee_id: str,
    current_user: dict = Depends(require_password_changed)
):
    if not ObjectId.is_valid(employee_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid employee ID"
        )

    query = {"_id": ObjectId(employee_id)}

    if current_user.get("role") == "employee":
        query["user_id"] = str(current_user["_id"])

    elif current_user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    employee = employees.find_one(query)

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee not found"
        )

    return serialize_employee(employee)


# ==========================================
# UPDATE EMPLOYEE
# Admin only
# ==========================================

@router.put("/{employee_id}")
def update_employee(
    employee_id: str,
    data: EmployeeUpdate,
    current_user: dict = Depends(require_admin)
):
    employee = get_employee_or_404(employee_id)
    linked_user = get_linked_user(employee)

    update_data = data.model_dump(
        exclude_unset=True,
        exclude_none=True,
        mode="json"
    )

    if not update_data:
        raise HTTPException(
            status_code=400,
            detail="No update details provided"
        )

    if "email" in update_data:
        update_data["email"] = str(update_data["email"]).strip().lower()

    validate_dates(update_data, employee)

    user_updates = {}

    if "name" in update_data:
        user_updates["name"] = update_data["name"]

    if "email" in update_data:
        new_email = update_data["email"]

        duplicate_user = users.find_one({
            "email": new_email,
            "_id": {"$ne": linked_user["_id"]}
        })

        duplicate_employee = employees.find_one({
            "email": new_email,
            "_id": {"$ne": employee["_id"]}
        })

        if duplicate_user or duplicate_employee:
            raise HTTPException(
                status_code=409,
                detail="Email already exists"
            )

        user_updates["email"] = new_email

    now = datetime.now(timezone.utc)

    try:
        with client.start_session() as session:
            with session.start_transaction():

                employee_result = employees.update_one(
                    {"_id": employee["_id"]},
                    {"$set": {
                        **update_data,
                        "updated_at": now
                    }},
                    session=session
                )

                if employee_result.matched_count != 1:
                    raise HTTPException(
                        status_code=404,
                        detail="Employee not found"
                    )

                if user_updates:
                    user_result = users.update_one(
                        {"_id": linked_user["_id"]},
                        {"$set": {
                            **user_updates,
                            "updated_at": now
                        }},
                        session=session
                    )

                    if user_result.matched_count != 1:
                        raise HTTPException(
                            status_code=409,
                            detail="Linked login account not found"
                        )

        updated_employee = employees.find_one({
            "_id": employee["_id"]
        })

        return {
            "message": "Employee updated successfully",
            "employee": serialize_employee(updated_employee)
        }

    except DuplicateKeyError as error:
        raise HTTPException(
            status_code=409,
            detail="Employee email already exists"
        ) from error


# ==========================================
# DEACTIVATE EMPLOYEE
# Admin only
# ==========================================

@router.patch("/{employee_id}/deactivate")
def deactivate_employee(
    employee_id: str,
    current_user: dict = Depends(require_admin)
):
    employee = get_employee_or_404(employee_id)
    linked_user = get_linked_user(employee)

    if employee.get("employment_status") == "Inactive":
        return {"message": "Employee is already inactive"}

    now = datetime.now(timezone.utc)

    try:
        with client.start_session() as session:
            with session.start_transaction():

                employee_result = employees.update_one(
                    {"_id": employee["_id"]},
                    {"$set": {
                        "employment_status": "Inactive",
                        "updated_at": now
                    }},
                    session=session
                )

                user_result = users.update_one(
                    {"_id": linked_user["_id"]},
                    {
                        "$inc": {"session_version": 1},
                        "$set": {"updated_at": now}
                    },
                    session=session
                )

                if (
                    employee_result.matched_count != 1
                    or user_result.matched_count != 1
                ):
                    raise RuntimeError(
                        "Employee deactivation could not be completed"
                    )

        return {"message": "Employee deactivated successfully"}

    except Exception as error:
        logger.exception("Employee deactivation failed")
        raise HTTPException(
            status_code=500,
            detail="Unable to deactivate employee"
        ) from error


# ==========================================
# ACTIVATE EMPLOYEE
# Admin only
# ==========================================

@router.patch("/{employee_id}/activate")
def activate_employee(
    employee_id: str,
    current_user: dict = Depends(require_admin)
):
    employee = get_employee_or_404(employee_id)
    linked_user = get_linked_user(employee)

    if linked_user.get("status") != "approved":
        raise HTTPException(
            status_code=409,
            detail="Employee account is not approved"
        )

    if employee.get("employment_status") == "Active":
        return {"message": "Employee is already active"}

    result = employees.update_one(
        {"_id": employee["_id"]},
        {"$set": {
            "employment_status": "Active",
            "updated_at": datetime.now(timezone.utc)
        }}
    )

    if result.matched_count != 1:
        raise HTTPException(
            status_code=404,
            detail="Employee not found"
        )

    return {"message": "Employee activated successfully"}


# ==========================================
# DELETE EMPLOYEE
# Admin only
# Documents and OCR history are preserved.
# ==========================================

@router.delete("/{employee_id}")
def delete_employee(
    employee_id: str,
    current_user: dict = Depends(require_admin)
):
    employee = get_employee_or_404(employee_id)
    linked_user = get_linked_user(employee)

    try:
        with client.start_session() as session:
            with session.start_transaction():

                user_result = users.delete_one(
                    {"_id": linked_user["_id"]},
                    session=session
                )

                employee_result = employees.delete_one(
                    {"_id": employee["_id"]},
                    session=session
                )

                if (
                    user_result.deleted_count != 1
                    or employee_result.deleted_count != 1
                ):
                    raise RuntimeError(
                        "Employee deletion could not be completed"
                    )

        return {
            "message": (
                "Employee and login account permanently deleted. "
                "Documents and OCR history preserved."
            ),
            "employee_id": employee.get("employee_id")
        }

    except Exception as error:
        logger.exception("Employee deletion failed")
        raise HTTPException(
            status_code=500,
            detail="Employee deletion failed. No changes were committed."
        ) from error
