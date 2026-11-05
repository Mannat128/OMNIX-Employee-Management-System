
from datetime import date
from typing import Literal, Self

from bson import ObjectId

from pydantic import (
    BaseModel,
    EmailStr,
    Field,
    ConfigDict,
    field_validator,
    model_validator
)


# ==========================================
# COMMON MODEL CONFIGURATION
# ==========================================

class BaseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ==========================================
# LOGIN REQUEST
# ==========================================

class LoginRequest(BaseRequest):

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


# ==========================================
# EMPLOYEE REGISTRATION REQUEST
# ==========================================

class RegisterRequest(BaseRequest):

    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    department: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("name", "department")
    @classmethod
    def validate_text_fields(cls, value):

        value = value.strip()

        if not value:
            raise ValueError("This field cannot be empty")

        return value


# ==========================================
# CHANGE PASSWORD REQUEST
# ==========================================

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


# ==========================================
# ADMIN RESET PASSWORD REQUEST
# ==========================================

class ResetPasswordRequest(BaseRequest):

    admin_password: str = Field(min_length=1, max_length=128)


# ==========================================
# OLD ADMIN EMPLOYEE DETAILS
# ==========================================

class OldAdminEmployeeDetails(BaseRequest):

    department: str = Field(min_length=2, max_length=100)

    phone: str = Field(
        pattern=r"^[0-9]{10}$"
    )

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

    @field_validator(
        "department",
        "city",
        "state",
        "designation"
    )
    @classmethod
    def validate_text_fields(cls, value):

        value = value.strip()

        if not value:
            raise ValueError("This field cannot be empty")

        return value

    @field_validator("date_of_birth")
    @classmethod
    def validate_date_of_birth(cls, value):

        if value >= date.today():
            raise ValueError(
                "Date of birth must be in the past"
            )

        return value

    @field_validator("joining_date")
    @classmethod
    def validate_joining_date(cls, value):

        if value > date.today():
            raise ValueError(
                "Joining date cannot be in the future"
            )

        return value

    @model_validator(mode="after")
    def validate_employment_dates(self) -> Self:

        if self.joining_date <= self.date_of_birth:
            raise ValueError(
                "Joining date must be after date of birth"
            )

        return self


# ==========================================
# ADMIN TRANSFER REQUEST
# ==========================================

class AdminTransferRequest(BaseRequest):

    target_employee_id: str

    admin_password: str = Field(
        min_length=1,
        max_length=128
    )

    old_admin_action: Literal["employee"] = "employee"

    old_admin_details: OldAdminEmployeeDetails

    @field_validator("target_employee_id")
    @classmethod
    def validate_target_employee_id(cls, value):

        value = value.strip()

        if not ObjectId.is_valid(value):
            raise ValueError("Invalid employee ID")

        return value
