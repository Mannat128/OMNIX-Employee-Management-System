
import os
import certifi

from datetime import datetime, timezone
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
from pwdlib import PasswordHash


# Load .env from project root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))


MONGODB_URL = os.getenv("MONGODB_URL")
DATABASE_NAME = os.getenv("DATABASE_NAME")
ADMIN_NAME = os.getenv("ADMIN_NAME")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")


# Validate environment variables
required_values = {
    "MONGODB_URL": MONGODB_URL,
    "DATABASE_NAME": DATABASE_NAME,
    "ADMIN_NAME": ADMIN_NAME,
    "ADMIN_EMAIL": ADMIN_EMAIL,
    "ADMIN_PASSWORD": ADMIN_PASSWORD
}

missing = [key for key, value in required_values.items() if not value]

if missing:
    raise RuntimeError(
        f"Missing environment variables: {', '.join(missing)}"
    )

if len(ADMIN_PASSWORD) < 8:
    raise RuntimeError("ADMIN_PASSWORD must contain at least 8 characters.")


password_hash = PasswordHash.recommended()


def create_admin():
    client = MongoClient(
        MONGODB_URL,
        serverSelectionTimeoutMS=5000,
        tlsCAFile=certifi.where()
    )

    try:
        client.admin.command("ping")

        db = client[DATABASE_NAME]
        users = db["users"]

        users.create_index("email", unique=True)

        admin_count = users.count_documents({"role": "admin"})

        # Never create a second admin automatically
        if admin_count > 1:
            print("ERROR: Multiple admin accounts already exist.")
            print("Resolve this manually before running the seed script.")
            return

        if admin_count == 1:
            existing_admin = users.find_one({"role": "admin"})

            if existing_admin["email"].lower() == ADMIN_EMAIL.lower():
                print("Admin account already exists.")
                print("No changes were made.")
            else:
                print("Another admin account already exists.")
                print("Use the Admin Transfer or recovery process.")

            return

        # Do not overwrite an existing employee account
        if users.find_one({"email": ADMIN_EMAIL.lower()}):
            print("This email already belongs to another account.")
            print("Admin was not created.")
            return

        admin_data = {
            "name": ADMIN_NAME.strip(),
            "email": ADMIN_EMAIL.strip().lower(),
            "password": password_hash.hash(ADMIN_PASSWORD),
            "role": "admin",
            "status": "approved",
            "mustChangePassword": False,
            "session_version": 0,
            "created_at": datetime.now(timezone.utc)
        }

        users.insert_one(admin_data)

        print("\nAdmin account created successfully!")
        print("Email:", ADMIN_EMAIL.lower())
        print("Role: admin")

    except DuplicateKeyError:
        print("This email is already registered.")

    finally:
        client.close()


if __name__ == "__main__":
    create_admin()
