
import os
import secrets
import string
import uuid

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from bson import ObjectId
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


# Generate secure temporary password
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
        secrets.choice(all_characters)
        for _ in range(7)
    )

    secrets.SystemRandom().shuffle(password_characters)

    return "".join(password_characters)


# Serialize MongoDB employee data
def serialize_employee(employee):

    return {
        "id": str(employee["_id"]),
        "employee_id": employee.get("employee_id"),
        "user_id": employee.get("user_id"),
        "name": employee["name"],
        "email": employee["email"],
        "department": employee["department"],
        "phone": employee.get("phone"),
        "date_of_birth": employee.get("date_of_birth"),
        "gender": employee.get("gender"),
        "city": employee.get("city"),
        "state": employee.get("state"),
        "designation": employee.get("designation"),
        "joining_date": employee.get("joining_date"),
        "employment_type": employee.get("employment_type"),
        "employment_status": employee.get(
            "employment_status", "Active"
        ),
        "profile_photo": employee.get("profile_photo")
    }


# CREATE - Admin can add employees
@router.post("/", status_code=201)
def add_employee(
    data: EmployeeCreate,
    current_user: dict = Depends(require_admin)
):

    email = str(data.email).lower()

    # Check duplicate email
    if users.find_one({"email": email}) or employees.find_one(
        {"email": email}
    ):
        raise HTTPException(
            status_code=409,
            detail="Employee email already exists"
        )

    temporary_password = generate_temporary_password()

    employee_id = generate_employee_id()

    employee_data = data.model_dump(mode="json")

    employee_data.update({
        "employee_id": employee_id,
        "email": email,
        "profile_photo": None,
        "employment_status": "Active",
        "created_at": datetime.now(timezone.utc)
    })

    user_data = {
        "name": data.name,
        "email": email,
        "password": hash_password(temporary_password),
        "role": "employee",
        "status": "approved",
        "mustChangePassword": True,
        "session_version": 0,
        "created_at": datetime.now(timezone.utc)
    }

    user_id = None

    try:

        # Create login account
        user_result = users.insert_one(user_data)
        user_id = user_result.inserted_id

        # Link employee profile to login account
        employee_data["user_id"] = str(user_id)

        employee_result = employees.insert_one(employee_data)

        return {
            "message": "Employee created successfully",
            "employee": {
                "id": str(employee_result.inserted_id),
                "employee_id": employee_id,
                "name": data.name,
                "email": email
            },
            "temporary_password": temporary_password,
            "mustChangePassword": True
        }

    except DuplicateKeyError:

        if user_id:
            users.delete_one({"_id": user_id})

        raise HTTPException(
            status_code=409,
            detail="Employee email or ID already exists"
        )

    except Exception:

        if user_id:
            users.delete_one({"_id": user_id})

        raise


# READ - Admin can view all employees
@router.get("/")
def get_all_employees(
    current_user: dict = Depends(require_admin)
):

    all_employees = employees.find().sort("created_at", -1)

    return [
        serialize_employee(employee)
        for employee in all_employees
    ]


# READ - Employee can view own profile
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


# UPDATE - Employee can edit limited profile fields
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

    update_data = data.model_dump(
        exclude_unset=True,
        exclude_none=True
    )

    if not update_data:
        raise HTTPException(
            status_code=400,
            detail="No profile details provided"
        )

    employee = employees.find_one({
        "user_id": str(current_user["_id"])
    })

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee profile not found"
        )

    employees.update_one(
        {"_id": employee["_id"]},
        {"$set": update_data}
    )

    updated_employee = employees.find_one({
        "_id": employee["_id"]
    })

    return {
        "message": "Profile updated successfully",
        "employee": serialize_employee(updated_employee)
    }


# UPLOAD - Employee can upload their own profile photo
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

    # Accept only JPG, JPEG and PNG files
    allowed_extensions = {".jpg", ".jpeg", ".png"}
    allowed_content_types = {"image/jpeg", "image/png"}

    extension = os.path.splitext(file.filename or "")[1].lower()

    if (
        extension not in allowed_extensions
        or file.content_type not in allowed_content_types
    ):
        raise HTTPException(
            status_code=400,
            detail="Only JPG, JPEG and PNG images are allowed"
        )

    try:

        # Read at most 2 MB + 1 byte
        max_file_size = 2 * 1024 * 1024
        file_content = await file.read(max_file_size + 1)

        if not file_content:
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty"
            )

        if len(file_content) > max_file_size:
            raise HTTPException(
                status_code=413,
                detail="Profile photo must be 2 MB or smaller"
            )

        # Validate actual image signature
        is_jpeg = file_content.startswith(b"\xff\xd8\xff")
        is_png = file_content.startswith(b"\x89PNG\r\n\x1a\n")

        if not (
            (extension in {".jpg", ".jpeg"} and is_jpeg)
            or (extension == ".png" and is_png)
        ):
            raise HTTPException(
                status_code=400,
                detail="The file content does not match a valid JPG or PNG image"
            )

        # Save inside backend/uploads/profile_photos
        photo_directory = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "uploads",
            "profile_photos"
        )

        os.makedirs(photo_directory, exist_ok=True)

        unique_filename = f"{uuid.uuid4().hex}{extension}"
        photo_path = os.path.join(photo_directory, unique_filename)
        photo_url = f"/uploads/profile_photos/{unique_filename}"

        with open(photo_path, "wb") as photo_file:
            photo_file.write(file_content)

        employees.update_one(
            {"_id": employee["_id"]},
            {"$set": {"profile_photo": photo_url}}
        )

    except Exception:
        if "photo_path" in locals() and os.path.exists(photo_path):
            os.remove(photo_path)
        raise

    finally:
        await file.close()

    # Remove previous photo only from our upload folder
    old_photo_url = employee.get("profile_photo")

    if old_photo_url and old_photo_url.startswith(
        "/uploads/profile_photos/"
    ):

        old_filename = os.path.basename(old_photo_url)
        old_photo_path = os.path.join(
            photo_directory,
            old_filename
        )

        if (
            os.path.isfile(old_photo_path)
            and old_filename != unique_filename
        ):
            try:
                os.remove(old_photo_path)
            except OSError:
                pass

    updated_employee = employees.find_one({
        "_id": employee["_id"]
    })

    return {
        "message": "Profile photo uploaded successfully",
        "profile_photo": photo_url,
        "employee": serialize_employee(updated_employee)
    }


# READ - Admin can view anyone; Employee can view only own record
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

    if current_user.get("role") != "admin":
        query["user_id"] = str(current_user["_id"])

    employee = employees.find_one(query)

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee not found"
        )

    return serialize_employee(employee)


# UPDATE - Only Admin can edit employee details
@router.put("/{employee_id}")
def update_employee(
    employee_id: str,
    data: EmployeeUpdate,
    current_user: dict = Depends(require_admin)
):

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

    user_id = employee.get("user_id")

    if not user_id or not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=409,
            detail="Employee login account is not linked"
        )

    linked_user_id = ObjectId(user_id)

    # Check email uniqueness
    new_email = update_data.get("email")

    if new_email:

        new_email = str(new_email).lower()

        duplicate_user = users.find_one({
            "email": new_email,
            "_id": {"$ne": linked_user_id}
        })

        duplicate_employee = employees.find_one({
            "email": new_email,
            "_id": {"$ne": ObjectId(employee_id)}
        })

        if duplicate_user or duplicate_employee:
            raise HTTPException(
                status_code=409,
                detail="Email already exists"
            )

        update_data["email"] = new_email

    try:

        # Both updates happen in one MongoDB transaction
        with client.start_session() as session:

            with session.start_transaction():

                # Update employee profile
                employee_result = employees.update_one(
                    {"_id": ObjectId(employee_id)},
                    {"$set": update_data},
                    session=session
                )

                if employee_result.matched_count != 1:
                    raise HTTPException(
                        status_code=404,
                        detail="Employee not found"
                    )

                # Prepare login account updates
                user_updates = {}

                if "name" in update_data:
                    user_updates["name"] = update_data["name"]

                if "email" in update_data:
                    user_updates["email"] = update_data["email"]

                # Synchronize login account
                if user_updates:

                    user_result = users.update_one(
                        {"_id": linked_user_id},
                        {"$set": user_updates},
                        session=session
                    )

                    if user_result.matched_count != 1:
                        raise HTTPException(
                            status_code=409,
                            detail="Linked login account not found"
                        )

                updated_employee = employees.find_one(
                    {"_id": ObjectId(employee_id)},
                    session=session
                )

        return {
            "message": "Employee updated successfully",
            "employee": serialize_employee(updated_employee)
        }

    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail="Employee email already exists"
        )


# DEACTIVATE - Admin can deactivate employee
@router.patch("/{employee_id}/deactivate")
def deactivate_employee(
    employee_id: str,
    current_user: dict = Depends(require_admin)
):

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
            detail="Only employee accounts can be deactivated here"
        )

    # Invalidate existing sessions
    users.update_one(
        {"_id": linked_user["_id"]},
        {"$inc": {"session_version": 1}}
    )

    employees.update_one(
        {"_id": ObjectId(employee_id)},
        {
            "$set": {
                "employment_status": "Inactive"
            }
        }
    )

    return {
        "message": "Employee deactivated successfully"
    }


# ACTIVATE - Admin can reactivate employee
@router.patch("/{employee_id}/activate")
def activate_employee(
    employee_id: str,
    current_user: dict = Depends(require_admin)
):

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

    user_id = employee.get("user_id")

    if not user_id or not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=409,
            detail="Employee login account is not linked"
        )

    linked_user = users.find_one({
        "_id": ObjectId(user_id),
        "role": "employee",
        "status": "approved"
    })

    if not linked_user:
        raise HTTPException(
            status_code=409,
            detail="Employee account is not eligible for activation"
        )

    employees.update_one(
        {"_id": ObjectId(employee_id)},
        {
            "$set": {
                "employment_status": "Active"
            }
        }
    )

    return {
        "message": "Employee activated successfully"
    }


# DELETE - Admin can permanently delete employee
# Documents and OCR history are preserved
@router.delete("/{employee_id}")
def delete_employee(
    employee_id: str,
    current_user: dict = Depends(require_admin)
):

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

                if user_result.deleted_count != 1:
                    raise RuntimeError(
                        "Unable to delete employee login account"
                    )

                if employee_result.deleted_count != 1:
                    raise RuntimeError(
                        "Unable to delete employee profile"
                    )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail="Employee deletion failed. No changes were committed."
        ) from error

    return {
        "message": "Employee and login account permanently deleted. Documents and OCR history preserved.",
        "employee_id": employee.get("employee_id")
    }
