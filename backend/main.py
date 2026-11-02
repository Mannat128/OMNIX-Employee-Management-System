
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database.connection import client, users, employees
from routes.auth import router as auth_router
from routes.admin import router as admin_router
from routes.employees import router as employee_router
from routes.documents import router as documents_router


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
        print("MongoDB connection closed.")


app = FastAPI(
    title="Employee Management System",
    description="Employee Management System API",
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


@app.get("/")
def home():
    return {
        "message": "Employee Management System API is running!"
    }


@app.get("/db-check")
def database_check():
    client.admin.command("ping")

    return {
        "message": "MongoDB connected successfully!"
    }
