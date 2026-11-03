
import os
import certifi

from dotenv import load_dotenv
from pymongo import MongoClient

# Load environment variables from .env
load_dotenv()

# MongoDB configuration
MONGODB_URL = os.getenv("MONGODB_URL")
DATABASE_NAME = os.getenv("DATABASE_NAME")

# Check environment variables
if not MONGODB_URL:
    raise RuntimeError("MONGODB_URL missing from .env")

if not DATABASE_NAME:
    raise RuntimeError("DATABASE_NAME missing from .env")


# MongoDB connection
client = MongoClient(
    MONGODB_URL,
    serverSelectionTimeoutMS=5000,
    tlsCAFile=certifi.where()
)

# Database
db = client[DATABASE_NAME]


# Database Collections
users = db["users"]

employees = db["employees"]

documents = db["documents"]

ocr_results = db["ocr_results"]

counters = db["counters"]


# Database connection test
def check_database_connection():
    try:
        client.admin.command("ping")
        print("MongoDB connected successfully!")
        return True

    except Exception as error:
        print(f"MongoDB connection failed: {error}")
        return False
