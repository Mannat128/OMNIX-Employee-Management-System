
from typing import Literal, Self

from pydantic import (
    BaseModel,
    Field,
    ConfigDict,
    field_validator,
    model_validator
)


# ==========================================
# BASE REQUEST MODEL
# ==========================================

class BaseRequest(BaseModel):

    model_config = ConfigDict(
        extra="forbid"
    )


# ==========================================
# CREATE TICKET MODEL
# ==========================================

class TicketCreate(BaseRequest):

    subject: str = Field(
        min_length=5,
        max_length=150
    )

    category: Literal[
        "Technical",
        "Documents",
        "Profile",
        "Account",
        "Other"
    ]

    description: str = Field(
        min_length=10,
        max_length=3000
    )

    @field_validator("subject")
    @classmethod
    def validate_subject(cls, value):

        value = value.strip()

        if len(value) < 5:
            raise ValueError(
                "Subject must contain at least 5 characters"
            )

        return value

    @field_validator("description")
    @classmethod
    def validate_description(cls, value):

        value = value.strip()

        if len(value) < 10:
            raise ValueError(
                "Description must contain at least 10 characters"
            )

        return value


# ==========================================
# UPDATE TICKET MODEL
# Admin updates status and priority
# ==========================================

class TicketUpdate(BaseRequest):

    status: Literal[
        "Open",
        "In Progress",
        "Resolved",
        "Closed"
    ] | None = None

    priority: Literal[
        "Low",
        "Medium",
        "High",
        "Urgent"
    ] | None = None

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
# TICKET REPLY MODEL
# Employee and Admin can reply
# ==========================================

class TicketReply(BaseRequest):

    message: str = Field(
        min_length=1,
        max_length=2000
    )

    @field_validator("message")
    @classmethod
    def validate_message(cls, value):

        value = value.strip()

        if not value:
            raise ValueError(
                "Reply cannot be empty"
            )

        return value
