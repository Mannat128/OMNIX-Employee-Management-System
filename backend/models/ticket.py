
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, ConfigDict, field_validator


# ==========================================
# BASE REQUEST MODEL
# ==========================================

class BaseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ==========================================
# CREATE TICKET MODEL
# Employee raises a new support ticket
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

    @field_validator("subject", "description")
    @classmethod
    def validate_text_fields(cls, value):

        value = value.strip()

        if not value:
            raise ValueError("This field cannot be empty")

        return value


# ==========================================
# UPDATE TICKET MODEL
# Admin updates ticket status and priority
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
            raise ValueError("Reply cannot be empty")

        return value
