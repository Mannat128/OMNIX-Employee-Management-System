from pydantic import BaseModel, EmailStr, Field


# User Registration Model
class Registration(BaseModel):
    name: str
    email: EmailStr
    department: str
    password: str = Field(min_length=8, max_length=128)


# User Login Model
class LoginRequest(BaseModel):
    email: EmailStr
    password: str