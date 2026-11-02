import os
from getpass import getpass
from datetime import datetime, timezone

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
from pwdlib import PasswordHash


# Load .env from project root
env_path = os.path.join(
    os.path.dirname(__file__),
    "..",
    ".env"
)
load_dotenv(env_path)

MONGODB_URL = os.getenv("MONGODB_URL")
DATABASE_NAME = os.getenv("DATABASE_NAME", "employee_db")

if not MONGODB_URL:
    raise RuntimeError("MONGODB_URL missing from .env")

client = MongoClient(
    MONGODB_URL,
    serverSelectionTimeoutMS=5000
)

password_hash = PasswordHash.recommended()


def create_admin():
    try:
        client.admin.command("ping")
        db = client[DATABASE_NAME]
        users = db["users"]

        users.create_index("email", unique=True)

        name = input("Enter admin name: ").strip()
        email = input("Enter admin email: ").strip().lower()
        password = getpass("Create admin password: ")
        confirm_password = getpass("Confirm admin password: ")

        if not name or not email:
            print("Name and email cannot be empty.")
            return

        if len(password) < 8:
            print("Password must contain at least 8 characters.")
            return

        if password != confirm_password:
            print("Passwords do not match.")
            return

        if users.find_one({"email": email}):
            print("This email is already registered.")
            print("Use a different email for the admin account.")
            return

        admin_data = {
            "name": name,
            "email": email,
            "password_hash": password_hash.hash(password),
            "role": "admin",
            "status": "approved",
            "created_at": datetime.now(timezone.utc)
        }

        try:
            users.insert_one(admin_data)
        except DuplicateKeyError:
            print("This email is already registered.")
            return

        print("\nAdmin account created successfully!")
        print("Email:", email)
        print("Role: admin")
        print("Status: approved")

    finally:
        client.close()


if __name__ == "__main__":
    create_admin()