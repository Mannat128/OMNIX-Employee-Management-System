
import os
import certifi

from dotenv import load_dotenv
from pymongo import MongoClient


# ==========================================
# LOAD ENVIRONMENT VARIABLES
# ==========================================

load_dotenv()


# ==========================================
# MONGODB CONFIGURATION
# ==========================================

MONGODB_URL = os.getenv("MONGODB_URL")
DATABASE_NAME = os.getenv("DATABASE_NAME")


if not MONGODB_URL:
    raise RuntimeError(
        "MONGODB_URL missing from .env"
    )

if not DATABASE_NAME:
    raise RuntimeError(
        "DATABASE_NAME missing from .env"
    )


# ==========================================
# MONGODB CLIENT CONNECTION
# ==========================================

client = MongoClient(
    MONGODB_URL,
    serverSelectionTimeoutMS=5000,
    tlsCAFile=certifi.where()
)


# ==========================================
# DATABASE
# ==========================================

db = client[DATABASE_NAME]


# ==========================================
# DATABASE COLLECTIONS
# ==========================================

users = db["users"]

employees = db["employees"]

documents = db["documents"]

ocr_results = db["ocr_results"]

counters = db["counters"]

tickets = db["tickets"]


# ==========================================
# DATABASE CONNECTION CHECK
# ==========================================

def check_database_connection():

    try:
        client.admin.command("ping")

        print("MongoDB connected successfully!")

        return True

    except Exception as error:

        print(f"MongoDB connection failed: {error}")

        return False
