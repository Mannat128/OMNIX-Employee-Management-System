
import secrets
import string

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from database.connection import (
    client,
    users,
    employees,
    counters
)

from dependencies.auth import require_admin
from core.security import verify_password

from models.user import (
    ResetPasswordRequest,
    AdminTransferRequest
)


router = APIRouter()


# ==========================================
# GENERATE SECURE TEMPORARY PASSWORD
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
        for _ in range(7)
    )

    secrets.SystemRandom().shuffle(password_characters)

    return "".join(password_characters)


# ==========================================
# GET ALL PENDING EMPLOYEE REGISTRATIONS
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
            status_code=400,
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
            status_code=404,
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
                    "Employee is no longer pending approval."
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
                        "This email is already linked to another account."
                    )

                employees.update_one(
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
                            "employment_status": existing_employee.get(
                                "employment_status", "Active"
                            )
                        }
                    },
                    session=session
                )

            else:
                counter = counters.find_one_and_update(
                    {"_id": "employee_id"},
                    {"$inc": {"sequence": 1}},
                    upsert=True,
                    return_document=ReturnDocument.AFTER,
                    session=session
                )

                employee_data = {
                    "user_id": str(user_object_id),
                    "employee_id": f"EMP{counter['sequence']:03d}",
                    "name": current_user["name"],
                    "email": email,
                    "department": current_user.get("department", ""),
                    "employment_status": "Active",
                    "profile_photo": None,
                    "created_at": datetime.now(timezone.utc)
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
                        "email": email
                    }
                },
                session=session
            )

            if result.modified_count != 1:
                raise RuntimeError(
                    "Employee approval could not be completed."
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
            status_code=409,
            detail=str(error)
        )

    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail="Employee email or ID already exists"
        )

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Employee approval failed. No changes were committed."
        )


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
            status_code=400,
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
                "status": "rejected"
            }
        }
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
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
            status_code=401,
            detail="Admin password is incorrect"
        )

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
            status_code=404,
            detail="Employee login account not found"
        )

    employee_user = users.find_one({
        "_id": ObjectId(user_id),
        "role": "employee"
    })

    if not employee_user:
        raise HTTPException(
            status_code=404,
            detail="Employee login account not found"
        )

    temporary_password = generate_temporary_password()

    result = users.update_one(
        {
            "_id": employee_user["_id"],
            "role": "employee"
        },
        {
            "$set": {
                "password": __import__(
                    "core.security",
                    fromlist=["hash_password"]
                ).hash_password(temporary_password),
                "mustChangePassword": False,
                "password_reset_at": datetime.now(timezone.utc)
            },
            "$inc": {
                "session_version": 1
            }
        }
    )

    if result.matched_count != 1:
        raise HTTPException(
            status_code=409,
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

    # 1. Verify current Admin password
    if not verify_password(
        data.admin_password,
        admin["password"]
    ):
        raise HTTPException(
            status_code=401,
            detail="Admin password is incorrect"
        )

    if not ObjectId.is_valid(data.target_employee_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid employee ID"
        )

    old_admin_id = admin["_id"]
    target_employee_id = ObjectId(data.target_employee_id)

    if users.count_documents({"role": "admin"}) != 1:
        raise HTTPException(
            status_code=409,
            detail="System must have exactly one Admin before transfer"
        )

    # 2. Check selected employee
    target_employee = employees.find_one({
        "_id": target_employee_id,
        "employment_status": "Active"
    })

    if not target_employee:
        raise HTTPException(
            status_code=404,
            detail="Active employee not found"
        )

    target_user_id = target_employee.get("user_id")

    if not target_user_id or not ObjectId.is_valid(target_user_id):
        raise HTTPException(
            status_code=404,
            detail="Employee login account not found"
        )

    target_user_id = ObjectId(target_user_id)

    if target_user_id == old_admin_id:
        raise HTTPException(
            status_code=400,
            detail="Cannot transfer Admin access to yourself"
        )

    target_user = users.find_one({
        "_id": target_user_id,
        "role": "employee",
        "status": "approved"
    })

    if not target_user:
        raise HTTPException(
            status_code=400,
            detail="Selected employee account is not eligible"
        )

    # 3. Verify old Admin does not already have an employee profile
    if employees.find_one({
        "user_id": str(old_admin_id)
    }):
        raise HTTPException(
            status_code=409,
            detail="Old Admin already has an employee profile"
        )

    # 4. Prepare old Admin employee details
    details = data.old_admin_details.model_dump(mode="json")

    old_admin_employee_data = {
        "user_id": str(old_admin_id),
        "name": admin["name"],
        "email": admin["email"],
        **details,
        "employee_id": None,
        "employment_status": "Active",
        "profile_photo": admin.get("profile_photo"),
        "created_at": datetime.now(timezone.utc)
    }

    # 5. Prepare shared lock document.
    # Every transfer writes to the same document inside its transaction.
    # This prevents concurrent transfers from independently passing
    # the Admin-count check.

    counters.update_one(
        {"_id": "admin_transfer_lock"},
        {
            "$setOnInsert": {
                "sequence": 0
            }
        },
        upsert=True
    )

    # 6. MongoDB transaction
    def transfer_transaction(session):

        # Acquire transaction-level write lock
        counters.find_one_and_update(
            {"_id": "admin_transfer_lock"},
            {"$inc": {"sequence": 1}},
            return_document=ReturnDocument.AFTER,
            session=session
        )

        # Recheck current Admin
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

        # Recheck selected employee profile
        current_employee = employees.find_one(
            {
                "_id": target_employee_id,
                "user_id": str(target_user_id),
                "employment_status": "Active"
            },
            session=session
        )

        # Recheck selected employee login account
        current_target = users.find_one(
            {
                "_id": target_user_id,
                "role": "employee",
                "status": "approved"
            },
            session=session
        )

        if not current_employee or not current_target:
            raise RuntimeError(
                "Selected employee is no longer eligible."
            )

        # Ensure old Admin still has no employee profile
        existing_profile = employees.find_one(
            {"user_id": str(old_admin_id)},
            session=session
        )

        if existing_profile:
            raise RuntimeError(
                "Old Admin already has an employee profile."
            )

        # Generate unique Employee ID
        counter = counters.find_one_and_update(
            {"_id": "employee_id"},
            {"$inc": {"sequence": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
            session=session
        )

        old_admin_employee_data["employee_id"] = (
            f"EMP{counter['sequence']:03d}"
        )

        # Create employee profile for old Admin
        employees.insert_one(
            old_admin_employee_data,
            session=session
        )

        # Demote old Admin to Employee.
        # Password is deliberately NOT modified.
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
                    "mustChangePassword": False
                },
                "$inc": {
                    "session_version": 1
                }
            },
            session=session
        )

        if old_admin_result.modified_count != 1:
            raise RuntimeError(
                "Current Admin account could not be updated."
            )

        # Copy employee profile fields to the new Admin's user document.
        # profile.py reads Admin profile details from the users collection.
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

        # Promote selected employee to Admin
        new_admin_result = users.update_one(
            {
                "_id": target_user_id,
                "role": "employee",
                "status": "approved"
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
                "Selected employee could not be promoted."
            )

        # Final validation
        final_admin_count = users.count_documents(
            {"role": "admin"},
            session=session
        )

        if final_admin_count != 1:
            raise RuntimeError(
                "Admin transfer validation failed."
            )

    # 7. Execute transaction
    try:
        with client.start_session() as session:
            session.with_transaction(transfer_transaction)

    except RuntimeError as error:
        raise HTTPException(
            status_code=409,
            detail=str(error)
        )

    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail="Employee ID or email already exists"
        )

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Admin transfer failed. No changes were committed."
        )

    # 8. Fetch updated accounts
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
