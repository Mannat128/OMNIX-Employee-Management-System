
import os
import certifi

from dotenv import load_dotenv
from pymongo import MongoClient

# Load environment variables
load_dotenv()

# MongoDB configuration
MONGODB_URL = os.getenv("MONGODB_URL")
DATABASE_NAME = os.getenv("DATABASE_NAME")

# Connect to MongoDB
client = MongoClient(
    MONGODB_URL,
    serverSelectionTimeoutMS=5000,
    tlsCAFile=certifi.where()
)

# Database
db = client[DATABASE_NAME]

# Collections
users = db["users"]
employees = db["employees"]
documents = db["documents"]
