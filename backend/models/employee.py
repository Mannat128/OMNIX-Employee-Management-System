
from datetime import date
from typing import Literal, Self

from pydantic import (
    BaseModel,
    EmailStr,
    Field,
    ConfigDict,
    field_validator,
    model_validator,
)


class BaseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class EmployeeCreate(BaseRequest):
    # Personal Details
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    department: str = Field(min_length=2, max_length=100)

    phone: str = Field(pattern=r"^[0-9]{10}$")
    date_of_birth: date
    gender: Literal["Male", "Female", "Other"]

    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)

    # Job Details
    designation: str = Field(min_length=2, max_length=100)
    joining_date: date

    employment_type: Literal[
        "Full-time",
        "Part-time",
        "Intern",
        "Contract"
    ]

    employment_status: Literal["Active", "Inactive"] = "Active"

    @field_validator(
        "name", "department", "city", "state", "designation"
    )
    @classmethod
    def validate_text_fields(cls, value):
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Field must contain at least 2 characters")
        return value

    @model_validator(mode="after")
    def validate_dates(self) -> Self:
        if self.joining_date < self.date_of_birth:
            raise ValueError("Joining date cannot be before date of birth")
        return self


class EmployeeUpdate(BaseRequest):
    # Admin can update employee details
    name: str | None = Field(default=None, min_length=2, max_length=100)
    email: EmailStr | None = None
    department: str | None = Field(default=None, min_length=2, max_length=100)

    phone: str | None = Field(
        default=None,
        pattern=r"^[0-9]{10}$"
    )

    date_of_birth: date | None = None
    gender: Literal["Male", "Female", "Other"] | None = None

    city: str | None = Field(default=None, min_length=2, max_length=100)
    state: str | None = Field(default=None, min_length=2, max_length=100)

    designation: str | None = Field(default=None, min_length=2, max_length=100)
    joining_date: date | None = None

    employment_type: Literal[
        "Full-time",
        "Part-time",
        "Intern",
        "Contract"
    ] | None = None

    employment_status: Literal["Active", "Inactive"] | None = None

    @field_validator(
        "name", "department", "city", "state", "designation"
    )
    @classmethod
    def validate_text_fields(cls, value):
        if value is not None:
            value = value.strip()
            if len(value) < 2:
                raise ValueError("Field must contain at least 2 characters")
        return value

    @model_validator(mode="after")
    def validate_update(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("At least one field is required")

        if (
            self.date_of_birth is not None
            and self.joining_date is not None
            and self.joining_date < self.date_of_birth
        ):
            raise ValueError("Joining date cannot be before date of birth")

        return self


class EmployeeProfileUpdate(BaseRequest):
    # Employee can update only these fields
    phone: str | None = Field(
        default=None,
        pattern=r"^[0-9]{10}$"
    )

    city: str | None = Field(default=None, min_length=2, max_length=100)
    state: str | None = Field(default=None, min_length=2, max_length=100)

    @field_validator("city", "state")
    @classmethod
    def validate_text_fields(cls, value):
        if value is not None:
            value = value.strip()
            if len(value) < 2:
                raise ValueError("Field must contain at least 2 characters")
        return value

    @model_validator(mode="after")
    def validate_update(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("At least one field is required")
        return self
