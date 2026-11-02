
from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from database.connection import employees
from models.employee import Employee
from dependencies.auth import get_current_user


router = APIRouter()


# Check Admin Permission
def require_admin(current_user: dict):
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )


# Convert MongoDB data into JSON response
def serialize_employee(employee):
    return {
        "id": str(employee["_id"]),
        "name": employee["name"],
        "email": employee["email"],
        "department": employee["department"]
    }


# CREATE - Only Admin can add employees
@router.post("/", status_code=201)
def add_employee(
    data: Employee,
    current_user: dict = Depends(get_current_user)
):
    require_admin(current_user)

    employee_data = data.model_dump()

    try:
        result = employees.insert_one(employee_data)

        new_employee = employees.find_one({
            "_id": result.inserted_id
        })

        return serialize_employee(new_employee)

    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail="Employee email already exists"
        )


# READ - Only Admin can view all employees
@router.get("/")
def get_all_employees(
    current_user: dict = Depends(get_current_user)
):
    require_admin(current_user)

    all_employees = employees.find()

    return [
        serialize_employee(employee)
        for employee in all_employees
    ]


# READ - Employee can view only their own record
@router.get("/me")
def get_my_employee_profile(
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") == "admin":
        raise HTTPException(
            status_code=400,
            detail="Use admin employee endpoints"
        )

    employee = employees.find_one({
        "email": current_user["email"]
    })

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Your employee profile is not available"
        )

    return serialize_employee(employee)


# READ - Admin can view anyone; Employee can view only own record
@router.get("/{employee_id}")
def get_employee(
    employee_id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(employee_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid employee ID"
        )

    query = {"_id": ObjectId(employee_id)}

    if current_user.get("role") != "admin":
        query["email"] = current_user["email"]

    employee = employees.find_one(query)

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee not found"
        )

    return serialize_employee(employee)


# UPDATE - Only Admin can update employees
@router.put("/{employee_id}")
def update_employee(
    employee_id: str,
    data: Employee,
    current_user: dict = Depends(get_current_user)
):
    require_admin(current_user)

    if not ObjectId.is_valid(employee_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid employee ID"
        )

    try:
        result = employees.update_one(
            {"_id": ObjectId(employee_id)},
            {"$set": data.model_dump()}
        )

        if result.matched_count == 0:
            raise HTTPException(
                status_code=404,
                detail="Employee not found"
            )

        updated_employee = employees.find_one({
            "_id": ObjectId(employee_id)
        })

        return serialize_employee(updated_employee)

    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail="Employee email already exists"
        )


# DELETE - Only Admin can delete employees
@router.delete("/{employee_id}")
def delete_employee(
    employee_id: str,
    current_user: dict = Depends(get_current_user)
):
    require_admin(current_user)

    if not ObjectId.is_valid(employee_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid employee ID"
        )

    result = employees.delete_one({
        "_id": ObjectId(employee_id)
    })

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Employee not found"
        )

    return {
        "message": "Employee deleted successfully"
    }
