
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database.connection import (
    client,
    users,
    employees,
    counters
)

from routes.auth import router as auth_router
from routes.admin import router as admin_router
from routes.employees import router as employee_router
from routes.documents import router as documents_router


# Profile photo upload directory
PROFILE_PHOTO_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "uploads",
    "profile_photos"
)

# Create directory if it does not exist
os.makedirs(PROFILE_PHOTO_DIR, exist_ok=True)


# MongoDB connection and database indexes
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        # Check MongoDB connection
        client.admin.command("ping")

        # Unique email for every user
        users.create_index("email", unique=True)

        # Unique email for every employee
        employees.create_index("email", unique=True)

        # Unique Employee ID
        employees.create_index(
            "employee_id",
            unique=True,
            sparse=True
        )

        print("MongoDB connected successfully!")
        print("Database indexes created successfully!")

        yield

    finally:
        client.close()
        print("MongoDB connection closed.")


# FastAPI application
app = FastAPI(
    title="OMNIX Employee Management System",
    description="Employee Management System API",
    version="2.0.0",
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


# Register API routes
app.include_router(auth_router)

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


# Home route
@app.get("/")
def home():
    return {
        "message": "OMNIX Employee Management System API is running!"
    }


# Database health check
@app.get("/db-check")
def database_check():
    client.admin.command("ping")

    return {
        "message": "MongoDB connection successful!"
    }
