
import jwt

from bson import ObjectId
from fastapi import HTTPException, Depends
from fastapi.security import (
    HTTPBearer,
    HTTPAuthorizationCredentials
)

from database.connection import users, employees
from core.security import JWT_SECRET, JWT_ALGORITHM


security = HTTPBearer(auto_error=False)


# ==========================================
# GET CURRENT LOGGED-IN USER
# ==========================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication token is required"
        )

    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={
                "require": ["exp", "iat", "sub"]
            }
        )

        user_id = payload.get("sub")

        if not isinstance(user_id, str) or not ObjectId.is_valid(user_id):
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token"
            )

        user = users.find_one({
            "_id": ObjectId(user_id)
        })

        if not user:
            raise HTTPException(
                status_code=401,
                detail="User account not found"
            )

        # SESSION VERSION VALIDATION
        token_version = payload.get("session_version")
        current_version = user.get("session_version", 0)

        if (
            type(token_version) is not int
            or type(current_version) is not int
            or token_version != current_version
        ):
            raise HTTPException(
                status_code=401,
                detail="Session expired. Please login again."
            )

        # ROLE VALIDATION
        role = user.get("role")

        if role not in ["admin", "employee"]:
            raise HTTPException(
                status_code=403,
                detail="Invalid user role"
            )

        if payload.get("role") != role:
            raise HTTPException(
                status_code=401,
                detail="User role changed. Please login again."
            )

        # ACCOUNT STATUS VALIDATION
        if user.get("status") != "approved":
            raise HTTPException(
                status_code=403,
                detail="Your account is not approved or is inactive."
            )

        # EMPLOYEE VALIDATION
        if role == "employee":
            employee = employees.find_one({
                "user_id": str(user["_id"])
            })

            if not employee:
                raise HTTPException(
                    status_code=403,
                    detail="Employee profile not found"
                )

            if employee.get("employment_status") != "Active":
                raise HTTPException(
                    status_code=403,
                    detail="Your employee account is inactive."
                )

        return user

    except HTTPException:
        raise

    except jwt.PyJWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired authentication token"
        )


# ==========================================
# REQUIRE PASSWORD CHANGE
# ==========================================

def require_password_changed(
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("mustChangePassword", False):
        raise HTTPException(
            status_code=403,
            detail={
                "message": "Please change your temporary password first.",
                "code": "PASSWORD_CHANGE_REQUIRED"
            }
        )

    return current_user


# ==========================================
# ADMIN-ONLY ACCESS
# ==========================================

def require_admin(
    current_user: dict = Depends(require_password_changed)
):
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    return current_user
