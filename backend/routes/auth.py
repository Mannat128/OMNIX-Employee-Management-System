
from fastapi import APIRouter, HTTPException, Depends, status
from pymongo.errors import DuplicateKeyError

from database.connection import users
from models.user import Registration, LoginRequest
from core.security import (
    hash_password,
    verify_password,
    create_access_token
)
from dependencies.auth import get_current_user


router = APIRouter()


# User Registration
@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(data: Registration):

    # Check whether this is the first registered account
    is_first_user = users.count_documents({}) == 0

    if is_first_user:
        role = "admin"
        account_status = "approved"
    else:
        role = "employee"
        account_status = "pending"

    new_user = {
        "name": data.name,
        "email": data.email,
        "password": hash_password(data.password),
        "role": role,
        "status": account_status
    }

    try:
        result = users.insert_one(new_user)

        if role == "admin":
            message = "Admin account created successfully."
        else:
            message = "Registration successful. Waiting for admin approval."

        return {
            "message": message,
            "user_id": str(result.inserted_id),
            "role": role,
            "status": account_status
        }

    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail="Email already registered"
        )


# User Login
@router.post("/login")
def login(data: LoginRequest):

    user = users.find_one({"email": data.email})

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not verify_password(data.password, user["password"]):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if user.get("role") == "employee" and user.get("status") != "approved":
        raise HTTPException(
            status_code=403,
            detail="Your account is pending admin approval"
        )

    token = create_access_token({
        "sub": str(user["_id"]),
        "email": user["email"],
        "role": user["role"]
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "status": user["status"]
        }
    }


# Get Current User Profile
@router.get("/me")
def get_profile(current_user: dict = Depends(get_current_user)):

    return {
        "id": str(current_user["_id"]),
        "name": current_user["name"],
        "email": current_user["email"],
        "role": current_user["role"],
        "status": current_user["status"]
    }
