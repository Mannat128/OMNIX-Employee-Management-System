
import os
import logging

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status
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

# Routers
from routes.auth import router as auth_router
from routes.admin import router as admin_router
from routes.employees import router as employee_router
from routes.documents import router as documents_router
from routes.ocr import router as ocr_router
from routes.profile import router as profile_router
from routes.tickets import router as tickets_router


# ==========================================
# LOGGING CONFIGURATION
# ==========================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s"
)

logger = logging.getLogger(__name__)


# ==========================================
# BASE DIRECTORY
# ==========================================

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)


# ==========================================
# UPLOAD DIRECTORIES
# ==========================================

PROFILE_PHOTO_DIR = os.path.join(
    BASE_DIR,
    "uploads",
    "profile_photos"
)

TICKET_UPLOAD_DIR = os.path.join(
    BASE_DIR,
    "uploads",
    "tickets"
)

os.makedirs(PROFILE_PHOTO_DIR, exist_ok=True)
os.makedirs(TICKET_UPLOAD_DIR, exist_ok=True)


# ==========================================
# MONGODB CONNECTION AND INDEXES
# ==========================================

@asynccontextmanager
async def lifespan(app: FastAPI):

    try:
        # Check MongoDB connection
        client.admin.command("ping")

        logger.info("MongoDB connected successfully")

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
        documents.create_index("employee_id")
        documents.create_index("user_id")

        # OCR results collection indexes
        ocr_results.create_index(
            "document_id",
            unique=True
        )

        ocr_results.create_index("employee_id")

        # OMNI Helpdesk indexes
        tickets.create_index(
            "ticket_number",
            unique=True
        )

        tickets.create_index("created_by")
        tickets.create_index("status")
        tickets.create_index("created_at")

        logger.info("MongoDB indexes created successfully")
        logger.info("Employee Management System API started")
        logger.info("OMNI Helpdesk module registered")

        yield

    except Exception:
        logger.exception(
            "Application startup or runtime lifecycle failed"
        )
        raise

    finally:
        client.close()
        logger.info("MongoDB connection closed")


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
# Public access
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

app.include_router(
    auth_router,
    prefix="/auth",
    tags=["Authentication"]
)

app.include_router(
    admin_router,
    prefix="/admin",
    tags=["Admin"]
)

app.include_router(
    employee_router,
    prefix="/employees",
    tags=["Employees"]
)

app.include_router(
    documents_router,
    prefix="/documents",
    tags=["Documents"]
)

app.include_router(
    ocr_router,
    prefix="/ocr",
    tags=["OCR"]
)

app.include_router(
    profile_router,
    prefix="/profile",
    tags=["Profile Management"]
)

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
        logger.exception("MongoDB health check failed")

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is currently unavailable"
        )
