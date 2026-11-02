import os
from contextlib import asynccontextmanager
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
load_dotenv()
MONGODB_URL = os.getenv("MONGODB_URL")
DATABASE_NAME = os.getenv("DATABASE_NAME", "employee_db")
if not MONGODB_URL:
    raise RuntimeError("MONGODB_URL is missing from .env")
client = MongoClient(
    MONGODB_URL,
    serverSelectionTimeoutMS=5000
)
db = client[DATABASE_NAME]
employees = db["employees"]
@asynccontextmanager
async def lifespan(app: FastAPI):
    client.admin.command("ping")
    print("MongoDB connected successfully!")
    yield
    client.close()
app = FastAPI(
    title="Employee Management System",
    lifespan=lifespan
)
class Employee(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    department: str = Field(min_length=1, max_length=100)
def serialize_employee(employee: dict) -> dict:
    employee["id"] = str(employee.pop("_id"))
    return employee
@app.get("/")
def home():
    return {"message": "Employee Management System API is running!"}
@app.get("/db-check")
def check_database():
    client.admin.command("ping")
    return {
        "message": "MongoDB connection successful!",
        "database": DATABASE_NAME
    }
@app.post("/employees", status_code=status.HTTP_201_CREATED)
def create_employee(employee: Employee):
    data = employee.model_dump()
    data["email"] = str(data["email"]).lower()
    try:
        result = employees.insert_one(data)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail="Employee email already exists"
        )
    saved_employee = employees.find_one(
        {"_id": result.inserted_id}
    )
    return serialize_employee(saved_employee)
@app.get("/employees")
def get_all_employees():
    return [
        serialize_employee(employee)
        for employee in employees.find()
    ]
@app.get("/employees")
def get_all_employees():
    return [
        serialize_employee(employee)
        for employee in employees.find()
    ]
@app.get("/employees/{employee_id}")
def get_employee(employee_id: str):
    if not ObjectId.is_valid(employee_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid employee ID"
        )
    employee = employees.find_one(
        {"_id": ObjectId(employee_id)}
    )
    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="Employee not found"
        )
    return serialize_employee(employee)
@app.put("/employees/{employee_id}")
def update_employee(employee_id: str, employee: Employee):
    if not ObjectId.is_valid(employee_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid employee ID"
        )
    existing_employee = employees.find_one(
        {"_id": ObjectId(employee_id)}
    )
    if existing_employee is None:
        raise HTTPException(
            status_code=404,
            detail="Employee not found"
        )
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
    updated_employee = employees.find_one(
        {"_id": ObjectId(employee_id)}
    )
    return serialize_employee(updated_employee)
@app.delete("/employees/{employee_id}")
def delete_employee(employee_id: str):
    if not ObjectId.is_valid(employee_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid employee ID"
        )
    result = employees.delete_one(
        {"_id": ObjectId(employee_id)}
    )
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Employee not found"
        )
    return {
        "message": "Employee deleted successfully"
    }