
from datetime import date
from typing import Literal, Self

from pydantic import (
    BaseModel,
    EmailStr,
    Field,
    ConfigDict,
    field_validator,
    model_validator
)


# Common model configuration
class BaseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


# Login Request
class LoginRequest(BaseRequest):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


# Employee Registration Request
class RegisterRequest(BaseRequest):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    department: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=8, max_length=128)


# Change Password Request
class ChangePasswordRequest(BaseRequest):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
    confirm_password: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def validate_passwords(self) -> Self:
        if self.new_password != self.confirm_password:
            raise ValueError("New passwords do not match")

        if self.current_password == self.new_password:
            raise ValueError(
                "New password must be different from current password"
            )

        return self


# Admin Reset Password Request
class ResetPasswordRequest(BaseRequest):
    admin_password: str = Field(min_length=1, max_length=128)


# Old Admin Employee Details
class OldAdminEmployeeDetails(BaseRequest):
    department: str = Field(min_length=2, max_length=100)
    phone: str = Field(pattern=r"^[0-9]{10}$")
    date_of_birth: date
    gender: Literal["Male", "Female", "Other"]
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)
    designation: str = Field(min_length=2, max_length=100)
    joining_date: date

    employment_type: Literal[
        "Full-time",
        "Part-time",
        "Intern",
        "Contract"
    ]


# Admin Transfer Request
# Only Option A is allowed:
# Current Admin becomes an Employee.
class AdminTransferRequest(BaseRequest):
    target_employee_id: str
    admin_password: str = Field(min_length=1, max_length=128)

    old_admin_action: Literal["employee"] = "employee"

    old_admin_details: OldAdminEmployeeDetails

    @field_validator("target_employee_id")
    @classmethod
    def validate_target_employee_id(cls, value):
        from bson import ObjectId

        if not ObjectId.is_valid(value):
            raise ValueError("Invalid employee ID")

        return value
