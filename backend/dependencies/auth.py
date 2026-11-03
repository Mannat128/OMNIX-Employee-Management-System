
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


# GET CURRENT LOGGED-IN USER
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
            algorithms=[JWT_ALGORITHM]
        )

        user_id = payload.get("sub")

        if not user_id or not ObjectId.is_valid(user_id):
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

        # Check session version
        token_version = payload.get("session_version", 0)
        current_version = user.get("session_version", 0)

        if token_version != current_version:
            raise HTTPException(
                status_code=401,
                detail="Session expired. Please login again."
            )

        # Validate role
        if user.get("role") not in ["admin", "employee"]:
            raise HTTPException(
                status_code=403,
                detail="Invalid user role"
            )

        # Employee-specific checks
        if user.get("role") == "employee":

            if user.get("status") != "approved":
                raise HTTPException(
                    status_code=403,
                    detail="Your account is not approved"
                )

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
                    detail="Your employee account is inactive"
                )

        return user

    except HTTPException:
        raise

    except jwt.PyJWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired authentication token"
        )


# REQUIRE EMPLOYEE TO CHANGE TEMPORARY PASSWORD
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


# ADMIN-ONLY ACCESS
def require_admin(
    current_user: dict = Depends(require_password_changed)
):
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    return current_user
