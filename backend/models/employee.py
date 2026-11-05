
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


# ==========================================
# BASE REQUEST MODEL
# ==========================================

class BaseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ==========================================
# COMMON VALIDATION
# ==========================================

def validate_text(value: str | None):

    if value is not None:

        value = value.strip()

        if len(value) < 2:
            raise ValueError(
                "Field must contain at least 2 characters"
            )

    return value


def validate_birth_date(value: date | None):

    if value is not None and value >= date.today():
        raise ValueError(
            "Date of birth must be in the past"
        )

    return value


def validate_joining_date(value: date | None):

    if value is not None and value > date.today():
        raise ValueError(
            "Joining date cannot be in the future"
        )

    return value


# ==========================================
# CREATE EMPLOYEE MODEL
# ==========================================

class EmployeeCreate(BaseRequest):

    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
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

    employment_status: Literal[
        "Active",
        "Inactive"
    ] = "Active"

    @field_validator(
        "name",
        "department",
        "city",
        "state",
        "designation"
    )
    @classmethod
    def validate_text_fields(cls, value):
        return validate_text(value)

    @field_validator("date_of_birth")
    @classmethod
    def validate_dob(cls, value):
        return validate_birth_date(value)

    @field_validator("joining_date")
    @classmethod
    def validate_joining(cls, value):
        return validate_joining_date(value)

    @model_validator(mode="after")
    def validate_dates(self) -> Self:

        if self.joining_date <= self.date_of_birth:
            raise ValueError(
                "Joining date must be after date of birth"
            )

        return self


# ==========================================
# UPDATE EMPLOYEE MODEL
# ADMIN ONLY
# ==========================================

class EmployeeUpdate(BaseRequest):

    name: str | None = Field(
        default=None,
        min_length=2,
        max_length=100
    )

    email: EmailStr | None = None

    department: str | None = Field(
        default=None,
        min_length=2,
        max_length=100
    )

    phone: str | None = Field(
        default=None,
        pattern=r"^[0-9]{10}$"
    )

    date_of_birth: date | None = None

    gender: Literal[
        "Male",
        "Female",
        "Other"
    ] | None = None

    city: str | None = Field(
        default=None,
        min_length=2,
        max_length=100
    )

    state: str | None = Field(
        default=None,
        min_length=2,
        max_length=100
    )

    designation: str | None = Field(
        default=None,
        min_length=2,
        max_length=100
    )

    joining_date: date | None = None

    employment_type: Literal[
        "Full-time",
        "Part-time",
        "Intern",
        "Contract"
    ] | None = None

    employment_status: Literal[
        "Active",
        "Inactive"
    ] | None = None

    @field_validator(
        "name",
        "department",
        "city",
        "state",
        "designation"
    )
    @classmethod
    def validate_text_fields(cls, value):
        return validate_text(value)

    @field_validator("date_of_birth")
    @classmethod
    def validate_dob(cls, value):
        return validate_birth_date(value)

    @field_validator("joining_date")
    @classmethod
    def validate_joining(cls, value):
        return validate_joining_date(value)

    @model_validator(mode="after")
    def validate_update(self) -> Self:

        if not self.model_fields_set:
            raise ValueError(
                "At least one field is required"
            )

        for field in self.model_fields_set:

            if getattr(self, field) is None:
                raise ValueError(
                    f"{field} cannot be null"
                )

        if (
            self.date_of_birth is not None
            and self.joining_date is not None
            and self.joining_date <= self.date_of_birth
        ):
            raise ValueError(
                "Joining date must be after date of birth"
            )

        return self


# ==========================================
# PERSONAL PROFILE UPDATE MODEL
# EMPLOYEE PERSONAL FIELDS ONLY
# ==========================================

class EmployeeProfileUpdate(BaseRequest):

    name: str | None = Field(
        default=None,
        min_length=2,
        max_length=100
    )

    email: EmailStr | None = None

    phone: str | None = Field(
        default=None,
        pattern=r"^[0-9]{10}$"
    )

    date_of_birth: date | None = None

    gender: Literal[
        "Male",
        "Female",
        "Other"
    ] | None = None

    city: str | None = Field(
        default=None,
        min_length=2,
        max_length=100
    )

    state: str | None = Field(
        default=None,
        min_length=2,
        max_length=100
    )

    @field_validator(
        "name",
        "city",
        "state"
    )
    @classmethod
    def validate_text_fields(cls, value):
        return validate_text(value)

    @field_validator("date_of_birth")
    @classmethod
    def validate_dob(cls, value):
        return validate_birth_date(value)

    @model_validator(mode="after")
    def validate_update(self) -> Self:

        if not self.model_fields_set:
            raise ValueError(
                "At least one field is required"
            )

        for field in self.model_fields_set:

            if getattr(self, field) is None:
                raise ValueError(
                    f"{field} cannot be null"
                )

        return self


# ==========================================
# ADMIN PROFESSIONAL PROFILE UPDATE MODEL
# ==========================================

class AdminProfessionalProfileUpdate(BaseRequest):

    department: str | None = Field(
        default=None,
        min_length=2,
        max_length=100
    )

    designation: str | None = Field(
        default=None,
        min_length=2,
        max_length=100
    )

    joining_date: date | None = None

    employment_type: Literal[
        "Full-time",
        "Part-time",
        "Intern",
        "Contract"
    ] | None = None

    employment_status: Literal[
        "Active",
        "Inactive"
    ] | None = None

    @field_validator(
        "department",
        "designation"
    )
    @classmethod
    def validate_text_fields(cls, value):
        return validate_text(value)

    @field_validator("joining_date")
    @classmethod
    def validate_joining(cls, value):
        return validate_joining_date(value)

    @model_validator(mode="after")
    def validate_update(self) -> Self:

        if not self.model_fields_set:
            raise ValueError(
                "At least one professional field is required"
            )

        for field in self.model_fields_set:

            if getattr(self, field) is None:
                raise ValueError(
                    f"{field} cannot be null"
                )

        return self
