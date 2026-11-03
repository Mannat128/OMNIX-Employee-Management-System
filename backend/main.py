
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
    ocr_results
)

from routes.auth import router as auth_router
from routes.admin import router as admin_router
from routes.employees import router as employee_router
from routes.documents import router as documents_router
from routes.ocr import router as ocr_router


# Profile photo directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

PROFILE_PHOTO_DIR = os.path.join(
    BASE_DIR,
    "uploads",
    "profile_photos"
)

os.makedirs(PROFILE_PHOTO_DIR, exist_ok=True)


# MongoDB connection and indexes
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

        print("MongoDB indexes created successfully!")
        print("Employee Management System API started!")

        yield

    finally:
        client.close()
        print("MongoDB connection closed.")


# Create FastAPI application
app = FastAPI(
    title="Employee Management System API",
    description=(
        "Employee Management System with Admin and Employee "
        "Authentication, Document Management and OCR."
    ),
    version="1.0.0",
    lifespan=lifespan
)


# CORS configuration
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


# Serve profile photos
app.mount(
    "/uploads/profile_photos",
    StaticFiles(directory=PROFILE_PHOTO_DIR),
    name="profile_photos"
)


# Register API routers
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


# Root endpoint
@app.get("/")
def home():
    return {
        "message": "Employee Management System API is running!",
        "status": "success"
    }


# Database health check
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
