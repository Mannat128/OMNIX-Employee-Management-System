
from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from database.connection import users, employees
from dependencies.auth import require_admin


router = APIRouter()


# Get all pending employee registrations
@router.get("/pending-users")
def get_pending_users(
    admin: dict = Depends(require_admin)
):
    pending_users = users.find({
        "role": "employee",
        "status": "pending"
    })

    return [
        {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "department": user.get("department", ""),
            "role": user["role"],
            "status": user["status"]
        }
        for user in pending_users
    ]


# Approve employee registration
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

    user = users.find_one({
        "_id": ObjectId(user_id),
        "role": "employee",
        "status": "pending"
    })

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Pending employee not found"
        )

    employee_data = {
        "name": user["name"],
        "email": user["email"],
        "department": user.get("department", "")
    }

    try:
        # Create employee profile if it does not exist
        employees.update_one(
            {"email": user["email"]},
            {"$setOnInsert": employee_data},
            upsert=True
        )

        # Approve employee account
        users.update_one(
            {
                "_id": ObjectId(user_id),
                "role": "employee",
                "status": "pending"
            },
            {
                "$set": {"status": "approved"}
            }
        )

        return {
            "message": "Employee approved successfully"
        }

    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail="Employee email already exists"
        )


# Reject employee registration
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
            "$set": {"status": "rejected"}
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
