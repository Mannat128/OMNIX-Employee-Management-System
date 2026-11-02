
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from database.connection import client, db, users, employees
import jwt
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
from pwdlib import PasswordHash


# Environment variables
load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL")
DATABASE_NAME = os.getenv("DATABASE_NAME", "employee_db")
JWT_SECRET = os.getenv("JWT_SECRET")

if not MONGODB_URL:
    raise RuntimeError("MONGODB_URL is missing from .env")

if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET is missing from .env")

JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = 60

security = HTTPBearer()
password_hash = PasswordHash.recommended()

# Application startup
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        client.admin.command("ping")
        users.create_index("email", unique=True)
        employees.create_index("email", unique=True)
        print("MongoDB connected successfully!")
        yield
    finally:
        client.close()


app = FastAPI(
    title="Employee Management System",
    description="Employee CRUD and JWT Authentication",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# Request models
class Employee(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    department: str = Field(min_length=1, max_length=100)


class Registration(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


# Helper: create employee response
def serialize_employee(employee: dict) -> dict:
    employee["id"] = str(employee.pop("_id"))
    return employee


# Helper: generate JWT
def create_access_token(user: dict) -> str:
    now = datetime.now(timezone.utc)

    payload = {
        "sub": str(user["_id"]),
        "email": user["email"],
        "role": user["role"],
        "iat": now,
        "exp": now + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM
    )


# Helper: verify JWT and get logged-in user
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM]
        )

        user_id = payload.get("sub")

        if not user_id or not ObjectId.is_valid(user_id):
            raise HTTPException(
                status_code=401,
                detail="Invalid token"
            )

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    user = users.find_one({"_id": ObjectId(user_id)})

    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    if user.get("role") != "admin" and user.get("status") != "approved":
        raise HTTPException(
            status_code=403,
            detail="Your account is not approved"
        )

    return user


# Helper: admin-only access
def require_admin(
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# Home
@app.get("/")
def home():
    return {"message": "Employee Management System API is running!"}


# Database check
@app.get("/db-check")
def check_database():
    try:
        client.admin.command("ping")
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Database connection failed"
        )

    return {
        "message": "MongoDB connection successful!",
        "database": DATABASE_NAME
    }


# Register user
@app.post("/register", status_code=status.HTTP_201_CREATED)
def register_employee(registration: Registration):
    name = registration.name.strip()

    if not name:
        raise HTTPException(status_code=422, detail="Name cannot be empty")

    email = str(registration.email).lower()

    user_data = {
        "name": name,
        "email": email,
        "password_hash": password_hash.hash(registration.password),
        "role": "employee",
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    }

    try:
        result = users.insert_one(user_data)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail="Email is already registered"
        )

    return {
        "message": "Registration successful. Awaiting admin approval.",
        "user": {
            "id": str(result.inserted_id),
            "name": name,
            "email": email,
            "role": "employee",
            "status": "pending"
        }
    }


# Login user
@app.post("/login")
def login(login_data: LoginRequest):
    email = str(login_data.email).lower()
    user = users.find_one({"email": email})

    if user is None or not password_hash.verify(
        login_data.password,
        user["password_hash"]
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if user.get("role") != "admin" and user.get("status") != "approved":
        raise HTTPException(
            status_code=403,
            detail="Your account is pending admin approval"
        )

    token = create_access_token(user)

    return {
        "message": "Login successful",
        "access_token": token,
        "token_type": "bearer",
        "expires_in": TOKEN_EXPIRE_MINUTES * 60,
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "status": user.get("status", "approved")
        }
    }


# Current logged-in user
@app.get("/me")
def my_profile(
    current_user: dict = Depends(get_current_user)
):
    return {
        "id": str(current_user["_id"]),
        "name": current_user["name"],
        "email": current_user["email"],
        "role": current_user["role"],
        "status": current_user.get("status", "approved")
    }


# Admin: view pending registrations
@app.get("/admin/pending-users")
def pending_users(
    admin: dict = Depends(require_admin)
):
    return [
        {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "status": user["status"]
        }
        for user in users.find({"status": "pending"})
    ]


# Admin: approve an employee
@app.patch("/admin/approve/{user_id}")
def approve_user(
    user_id: str,
    admin: dict = Depends(require_admin)
):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    result = users.update_one(
        {
            "_id": ObjectId(user_id),
            "role": "employee",
            "status": "pending"
        },
        {
            "$set": {
                "status": "approved",
                "approved_at": datetime.now(timezone.utc),
                "approved_by": str(admin["_id"])
            }
        }
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Pending employee not found"
        )

    return {"message": "Employee approved successfully"}


# Create employee record
@app.post("/employees", status_code=status.HTTP_201_CREATED)
def create_employee(
    employee: Employee,
    current_user: dict = Depends(get_current_user)
):
    data = employee.model_dump()
    data["email"] = str(data["email"]).lower()

    try:
        result = employees.insert_one(data)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail="Employee email already exists"
        )

    return serialize_employee(
        employees.find_one({"_id": result.inserted_id})
    )


# Get all employee records
@app.get("/employees")
def get_all_employees(
    current_user: dict = Depends(get_current_user)
):
    return [
        serialize_employee(employee)
        for employee in employees.find()
    ]


# Get one employee record
@app.get("/employees/{employee_id}")
def get_employee(
    employee_id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(employee_id):
        raise HTTPException(status_code=400, detail="Invalid employee ID")

    employee = employees.find_one({"_id": ObjectId(employee_id)})

    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")

    return serialize_employee(employee)


# Update employee record
@app.put("/employees/{employee_id}")
def update_employee(
    employee_id: str,
    employee: Employee,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(employee_id):
        raise HTTPException(status_code=400, detail="Invalid employee ID")

    if not employees.find_one({"_id": ObjectId(employee_id)}):
        raise HTTPException(status_code=404, detail="Employee not found")

    data = employee.model_dump()
    data["email"] = str(data["email"]).lower()

    try:
        employees.update_one(
            {"_id": ObjectId(employee_id)},
            {"$set": data}
        )
    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail="Employee email already exists"
        )

    return serialize_employee(
        employees.find_one({"_id": ObjectId(employee_id)})
    )


# Delete employee record
@app.delete("/employees/{employee_id}")
def delete_employee(
    employee_id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(employee_id):
        raise HTTPException(status_code=400, detail="Invalid employee ID")

    result = employees.delete_one({"_id": ObjectId(employee_id)})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")

    return {"message": "Employee deleted successfully"}