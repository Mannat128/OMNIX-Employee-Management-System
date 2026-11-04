
import os

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database.connection import (
    client,
    users,
    employees,
    documents,
    ocr_results,
    tickets
)

# Existing routers
from routes.auth import router as auth_router
from routes.admin import router as admin_router
from routes.employees import router as employee_router
from routes.documents import router as documents_router
from routes.ocr import router as ocr_router
from routes.profile import router as profile_router

# OMNI Helpdesk router
from routes.tickets import router as tickets_router


# ==========================================
# BASE DIRECTORY
# ==========================================

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)


# ==========================================
# PROFILE PHOTO DIRECTORY
# ==========================================

PROFILE_PHOTO_DIR = os.path.join(
    BASE_DIR,
    "uploads",
    "profile_photos"
)

os.makedirs(
    PROFILE_PHOTO_DIR,
    exist_ok=True
)


# ==========================================
# TICKET ATTACHMENT DIRECTORY
# ==========================================

TICKET_UPLOAD_DIR = os.path.join(
    BASE_DIR,
    "uploads",
    "tickets"
)

os.makedirs(
    TICKET_UPLOAD_DIR,
    exist_ok=True
)


# ==========================================
# MONGODB CONNECTION AND INDEXES
# ==========================================

@asynccontextmanager
async def lifespan(app: FastAPI):

    try:

        # Check MongoDB connection
        client.admin.command("ping")

        print("MongoDB connected successfully!")

        # Users collection indexes
        users.create_index(
            "email",
            unique=True
        )

        # Employees collection indexes
        employees.create_index(
            "email",
            unique=True
        )

        employees.create_index(
            "employee_id",
            unique=True,
            sparse=True
        )

        employees.create_index(
            "user_id",
            unique=True,
            sparse=True
        )

        # Documents collection indexes
        documents.create_index(
            "employee_id"
        )

        documents.create_index(
            "user_id"
        )

        # OCR results collection indexes
        ocr_results.create_index(
            "document_id",
            unique=True
        )

        ocr_results.create_index(
            "employee_id"
        )

        # OMNI Helpdesk indexes
        tickets.create_index(
            "ticket_number",
            unique=True
        )

        tickets.create_index(
            "created_by"
        )

        tickets.create_index(
            "status"
        )

        tickets.create_index(
            "created_at"
        )

        print("MongoDB indexes created successfully!")
        print("Employee Management System API started!")
        print("OMNI Helpdesk module registered!")

        yield

    finally:

        client.close()

        print("MongoDB connection closed.")


# ==========================================
# CREATE FASTAPI APPLICATION
# ==========================================

app = FastAPI(
    title="Employee Management System API",

    description=(
        "Employee Management System with Admin and Employee "
        "Authentication, Profile Management, Document Management, "
        "OCR and OMNI Helpdesk."
    ),

    version="1.1.0",

    lifespan=lifespan
)


# ==========================================
# CORS CONFIGURATION
# ==========================================

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


# ==========================================
# SERVE PROFILE PHOTOS
# ==========================================

app.mount(
    "/uploads/profile_photos",

    StaticFiles(
        directory=PROFILE_PHOTO_DIR
    ),

    name="profile_photos"
)


# ==========================================
# REGISTER API ROUTERS
# ==========================================

# Authentication
app.include_router(
    auth_router,
    prefix="/auth",
    tags=["Authentication"]
)


# Admin
app.include_router(
    admin_router,
    prefix="/admin",
    tags=["Admin"]
)


# Employees
app.include_router(
    employee_router,
    prefix="/employees",
    tags=["Employees"]
)


# Documents
app.include_router(
    documents_router,
    prefix="/documents",
    tags=["Documents"]
)


# OCR
app.include_router(
    ocr_router,
    prefix="/ocr",
    tags=["OCR"]
)


# Profile Management
app.include_router(
    profile_router,
    prefix="/profile",
    tags=["Profile Management"]
)


# OMNI Helpdesk
app.include_router(
    tickets_router,
    prefix="/tickets",
    tags=["OMNI Helpdesk"]
)


# ==========================================
# ROOT ENDPOINT
# ==========================================

@app.get("/")
def home():

    return {
        "message": "Employee Management System API is running!",
        "status": "success",
        "modules": [
            "Authentication",
            "Admin",
            "Employees",
            "Documents",
            "OCR",
            "Profile Management",
            "OMNI Helpdesk"
        ]
    }


# ==========================================
# DATABASE HEALTH CHECK
# ==========================================

@app.get("/db-check")
def database_check():

    try:

        client.admin.command("ping")

        return {
            "message": "MongoDB connected successfully!",
            "status": "connected"
        }

    except Exception:

        return {
            "message": "MongoDB connection failed",
            "status": "disconnected"
        }
