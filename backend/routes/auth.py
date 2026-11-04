
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, status
from pymongo.errors import DuplicateKeyError

from database.connection import users, employees

from models.user import (
    LoginRequest,
    RegisterRequest,
    ChangePasswordRequest
)

from core.security import (
    hash_password,
    verify_password,
    create_access_token
)

from dependencies.auth import get_current_user


router = APIRouter()


# ==========================================
# USER REGISTRATION
# ==========================================

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_user(data: RegisterRequest):

    email = str(data.email).lower().strip()

    # Check whether email already exists
    if users.find_one({"email": email}) or employees.find_one(
        {"email": email}
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    # Prepare new employee account
    user_data = {
        "name": data.name.strip(),
        "email": email,
        "department": data.department.strip(),
        "password": hash_password(data.password),
        "role": "employee",
        "status": "pending",
        "mustChangePassword": False,
        "session_version": 0,
        "created_at": datetime.now(timezone.utc)
    }

    try:
        result = users.insert_one(user_data)

    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    return {
        "message": (
            "Registration successful. "
            "Please wait for admin approval."
        ),
        "user_id": str(result.inserted_id),
        "status": "pending"
    }


# ==========================================
# USER LOGIN
# ==========================================

@router.post("/login")
def login(data: LoginRequest):

    email = str(data.email).lower().strip()

    user = users.find_one({"email": email})

    # Validate credentials
    if not user or not verify_password(
        data.password,
        user["password"]
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    role = user.get("role")

    # Validate role
    if role not in ["admin", "employee"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid account role"
        )

    # Employee account checks
    if role == "employee":

        if user.get("status") != "approved":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is not approved"
            )

        employee = employees.find_one({
            "user_id": str(user["_id"])
        })

        if not employee:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Employee profile not found"
            )

        if employee.get("employment_status") != "Active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is inactive. Contact Admin."
            )

    # Generate JWT token
    token = create_access_token({
        "sub": str(user["_id"]),
        "email": user["email"],
        "role": role,
        "session_version": user.get("session_version", 0)
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "mustChangePassword": user.get(
            "mustChangePassword", False
        ),
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "role": role,
            "status": user.get("status")
        }
    }


# ==========================================
# CHANGE PASSWORD
# ==========================================

@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user)
):

    # Verify current password
    if not verify_password(
        data.current_password,
        current_user["password"]
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    # Update password and invalidate existing sessions
    result = users.update_one(
        {
            "_id": current_user["_id"],
            "password": current_user["password"]
        },
        {
            "$set": {
                "password": hash_password(data.new_password),
                "mustChangePassword": False
            },
            "$inc": {
                "session_version": 1
            }
        }
    )

    if result.modified_count != 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Password could not be updated. Please try again."
        )

    return {
        "message": "Password changed successfully. Please login again."
    }


# ==========================================
# GET CURRENT USER PROFILE
# ==========================================

@router.get("/me")
def get_profile(
    current_user: dict = Depends(get_current_user)
):

    return {
        "id": str(current_user["_id"]),
        "name": current_user["name"],
        "email": current_user["email"],
        "role": current_user["role"],
        "status": current_user.get("status"),
        "mustChangePassword": current_user.get(
            "mustChangePassword", False
        )
    }
