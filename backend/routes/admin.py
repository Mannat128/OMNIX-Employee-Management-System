
import logging
import secrets
import string

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from database.connection import (
    client,
    users,
    employees,
    counters
)

from dependencies.auth import require_admin

from core.security import (
    verify_password,
    hash_password
)

from core.employee_id import generate_employee_id

from models.user import (
    ResetPasswordRequest,
    AdminTransferRequest
)


router = APIRouter()
logger = logging.getLogger(__name__)


# ==========================================
# GENERATE TEMPORARY PASSWORD
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
        secrets.choice(all_characters)
        for _ in range(9)
    )

    secrets.SystemRandom().shuffle(password_characters)

    return "".join(password_characters)


# ==========================================
# GET PENDING EMPLOYEE REGISTRATIONS
# ==========================================

@router.get("/pending-users")
def get_pending_users(
    admin: dict = Depends(require_admin)
):

    pending_users = users.find({
        "role": "employee",
        "status": "pending"
    }).sort("created_at", -1)

    return [
        {
            "id": str(user["_id"]),
            "name": user.get("name", ""),
            "email": user.get("email", ""),
            "department": user.get("department", ""),
            "role": user.get("role"),
            "status": user.get("status")
        }
        for user in pending_users
    ]


# ==========================================
# APPROVE EMPLOYEE REGISTRATION
# ==========================================

@router.patch("/approve/{user_id}")
def approve_user(
    user_id: str,
    admin: dict = Depends(require_admin)
):

    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID"
        )

    user_object_id = ObjectId(user_id)

    user = users.find_one({
        "_id": user_object_id,
        "role": "employee",
        "status": "pending"
    })

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pending employee not found"
        )

    email = user["email"].strip().lower()

    try:

        def approval_transaction(session):

            current_user = users.find_one(
                {
                    "_id": user_object_id,
                    "role": "employee",
                    "status": "pending"
                },
                session=session
            )

            if not current_user:
                raise RuntimeError(
                    "Employee is no longer pending approval"
                )

            existing_employee = employees.find_one(
                {"email": email},
                session=session
            )

            if existing_employee:

                existing_user_id = existing_employee.get("user_id")

                if (
                    existing_user_id
                    and existing_user_id != str(user_object_id)
                ):
                    raise RuntimeError(
                        "Email is already linked to another account"
                    )

                employment_status = existing_employee.get(
                    "employment_status",
                    "Active"
                )

                update_result = employees.update_one(
                    {
                        "_id": existing_employee["_id"],
                        "$or": [
                            {"user_id": {"$exists": False}},
                            {"user_id": None},
                            {"user_id": str(user_object_id)}
                        ]
                    },
                    {
                        "$set": {
                            "user_id": str(user_object_id),
                            "name": current_user["name"],
                            "email": email,
                            "department": current_user.get(
                                "department", ""
                            ),
                            "employment_status": employment_status,
                            "updated_at": datetime.now(timezone.utc)
                        }
                    },
                    session=session
                )

                if update_result.matched_count != 1:
                    raise RuntimeError(
                        "Employee profile could not be linked"
                    )

            else:

                employee_data = {
                    "user_id": str(user_object_id),
                    "employee_id": generate_employee_id(
                        session=session
                    ),
                    "name": current_user["name"],
                    "email": email,
                    "department": current_user.get("department", ""),
                    "employment_status": "Active",
                    "profile_photo": None,
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc)
                }

                employees.insert_one(
                    employee_data,
                    session=session
                )

            result = users.update_one(
                {
                    "_id": user_object_id,
                    "role": "employee",
                    "status": "pending"
                },
                {
                    "$set": {
                        "status": "approved",
                        "email": email,
                        "updated_at": datetime.now(timezone.utc)
                    }
                },
                session=session
            )

            if result.modified_count != 1:
                raise RuntimeError(
                    "Employee approval could not be completed"
                )

        with client.start_session() as session:
            session.with_transaction(approval_transaction)

        return {
            "message": "Employee approved successfully",
            "employee": {
                "user_id": str(user_object_id),
                "name": user["name"],
                "email": email
            }
        }

    except RuntimeError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error)
        ) from error

    except DuplicateKeyError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Employee email or ID already exists"
        ) from error

    except Exception as error:
        logger.exception("Employee approval failed")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Employee approval failed. No changes were committed."
        ) from error


# ==========================================
# REJECT EMPLOYEE REGISTRATION
# ==========================================

@router.patch("/reject/{user_id}")
def reject_user(
    user_id: str,
    admin: dict = Depends(require_admin)
):

    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID"
        )

    result = users.update_one(
        {
            "_id": ObjectId(user_id),
            "role": "employee",
            "status": "pending"
        },
        {
            "$set": {
                "status": "rejected",
                "updated_at": datetime.now(timezone.utc)
            },
            "$inc": {
                "session_version": 1
            }
        }
    )

    if result.matched_count != 1:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pending employee not found"
        )

    return {
        "message": "Employee registration rejected"
    }


# ==========================================
# RESET EMPLOYEE PASSWORD
# ==========================================

@router.post("/reset-password/{employee_id}")
def reset_employee_password(
    employee_id: str,
    data: ResetPasswordRequest,
    admin: dict = Depends(require_admin)
):

    if not verify_password(
        data.admin_password,
        admin["password"]
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin password is incorrect"
        )

    if not ObjectId.is_valid(employee_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid employee ID"
        )

    employee = employees.find_one({
        "_id": ObjectId(employee_id)
    })

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )

    user_id = employee.get("user_id")

    if not user_id or not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee login account not found"
        )

    employee_user = users.find_one({
        "_id": ObjectId(user_id),
        "role": "employee"
    })

    if not employee_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee login account not found"
        )

    temporary_password = generate_temporary_password()
    current_version = employee_user.get("session_version", 0)

    result = users.update_one(
        {
            "_id": employee_user["_id"],
            "role": "employee",
            "$or": [
                {"session_version": current_version},
                {"session_version": {"$exists": False}}
            ]
        },
        {
            "$set": {
                "password": hash_password(temporary_password),
                "mustChangePassword": True,
                "password_reset_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            },
            "$inc": {
                "session_version": 1
            }
        }
    )

    if result.modified_count != 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Password reset could not be completed"
        )

    return {
        "message": "Employee password reset successfully",
        "temporary_password": temporary_password,
        "mustChangePassword": True
    }


# ==========================================
# TRANSFER ADMIN ACCESS
# Old Admin -> Employee
# Selected Employee -> Admin
# ==========================================

@router.post("/transfer-access")
def transfer_admin_access(
    data: AdminTransferRequest,
    admin: dict = Depends(require_admin)
):

    if not verify_password(
        data.admin_password,
        admin["password"]
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin password is incorrect"
        )

    if not ObjectId.is_valid(data.target_employee_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid employee ID"
        )

    old_admin_id = admin["_id"]
    target_employee_id = ObjectId(data.target_employee_id)

    if users.count_documents({"role": "admin"}) != 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="System must have exactly one Admin before transfer"
        )

    target_employee = employees.find_one({
        "_id": target_employee_id,
        "employment_status": "Active"
    })

    if not target_employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active employee not found"
        )

    target_user_id = target_employee.get("user_id")

    if not target_user_id or not ObjectId.is_valid(target_user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee login account not found"
        )

    target_user_id = ObjectId(target_user_id)

    if target_user_id == old_admin_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot transfer Admin access to yourself"
        )

    target_user = users.find_one({
        "_id": target_user_id,
        "role": "employee",
        "status": "approved"
    })

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected employee account is not eligible"
        )

    if target_user.get("mustChangePassword", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected employee must change their temporary password first"
        )

    if employees.find_one({
        "user_id": str(old_admin_id)
    }):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Old Admin already has an employee profile"
        )

    details = data.old_admin_details.model_dump(mode="json")

    old_admin_employee_data = {
        "user_id": str(old_admin_id),
        "name": admin["name"],
        "email": admin["email"],
        **details,
        "employee_id": None,
        "employment_status": "Active",
        "profile_photo": admin.get("profile_photo"),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }

    # Shared lock prevents concurrent Admin transfers.
    counters.update_one(
        {"_id": "admin_transfer_lock"},
        {
            "$setOnInsert": {
                "sequence": 0
            }
        },
        upsert=True
    )

    def transfer_transaction(session):

        counters.find_one_and_update(
            {"_id": "admin_transfer_lock"},
            {"$inc": {"sequence": 1}},
            return_document=ReturnDocument.AFTER,
            session=session
        )

        current_admin = users.find_one(
            {
                "_id": old_admin_id,
                "role": "admin",
                "status": "approved"
            },
            session=session
        )

        admin_count = users.count_documents(
            {"role": "admin"},
            session=session
        )

        if not current_admin or admin_count != 1:
            raise RuntimeError(
                "Admin account changed. Transfer cancelled."
            )

        current_employee = employees.find_one(
            {
                "_id": target_employee_id,
                "user_id": str(target_user_id),
                "employment_status": "Active"
            },
            session=session
        )

        current_target = users.find_one(
            {
                "_id": target_user_id,
                "role": "employee",
                "status": "approved",
                "mustChangePassword": {"$ne": True}
            },
            session=session
        )

        if not current_employee or not current_target:
            raise RuntimeError(
                "Selected employee is no longer eligible"
            )

        existing_profile = employees.find_one(
            {"user_id": str(old_admin_id)},
            session=session
        )

        if existing_profile:
            raise RuntimeError(
                "Old Admin already has an employee profile"
            )

        old_admin_employee_data["employee_id"] = generate_employee_id(
            session=session
        )

        employees.insert_one(
            old_admin_employee_data,
            session=session
        )

        old_admin_result = users.update_one(
            {
                "_id": old_admin_id,
                "role": "admin",
                "status": "approved"
            },
            {
                "$set": {
                    "role": "employee",
                    "status": "approved",
                    "mustChangePassword": False,
                    "updated_at": datetime.now(timezone.utc)
                },
                "$inc": {
                    "session_version": 1
                }
            },
            session=session
        )

        if old_admin_result.modified_count != 1:
            raise RuntimeError(
                "Current Admin account could not be updated"
            )

        profile_fields = [
            "employee_id",
            "phone",
            "date_of_birth",
            "gender",
            "city",
            "state",
            "department",
            "designation",
            "joining_date",
            "employment_type",
            "employment_status",
            "profile_photo"
        ]

        new_admin_profile = {
            field: current_employee[field]
            for field in profile_fields
            if field in current_employee
        }

        new_admin_result = users.update_one(
            {
                "_id": target_user_id,
                "role": "employee",
                "status": "approved",
                "mustChangePassword": {"$ne": True}
            },
            {
                "$set": {
                    **new_admin_profile,
                    "role": "admin",
                    "status": "approved",
                    "mustChangePassword": False,
                    "updated_at": datetime.now(timezone.utc)
                },
                "$inc": {
                    "session_version": 1
                }
            },
            session=session
        )

        if new_admin_result.modified_count != 1:
            raise RuntimeError(
                "Selected employee could not be promoted"
            )

        final_admin_count = users.count_documents(
            {"role": "admin"},
            session=session
        )

        if final_admin_count != 1:
            raise RuntimeError(
                "Admin transfer validation failed"
            )

    try:

        with client.start_session() as session:
            session.with_transaction(transfer_transaction)

    except RuntimeError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error)
        ) from error

    except DuplicateKeyError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Employee ID or email already exists"
        ) from error

    except Exception as error:
        logger.exception("Admin transfer failed")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Admin transfer failed. No changes were committed."
        ) from error

    updated_new_admin = users.find_one({
        "_id": target_user_id
    })

    return {
        "message": "Admin access transferred successfully",
        "new_admin": {
            "name": updated_new_admin.get("name"),
            "email": updated_new_admin.get("email")
        },
        "old_admin": {
            "name": admin.get("name"),
            "role": "employee",
            "employee_id": old_admin_employee_data["employee_id"]
        },
        "admin_count": 1
    }
