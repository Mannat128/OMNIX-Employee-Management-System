
from pydantic import BaseModel, EmailStr


# Employee Model
class Employee(BaseModel):
    name: str
    email: EmailStr
    department: str
