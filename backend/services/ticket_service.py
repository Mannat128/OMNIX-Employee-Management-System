
from datetime import datetime, timezone

from bson import ObjectId
from pymongo import ReturnDocument

from database.connection import tickets, counters, employees


# ==========================================
# SERIALIZE TICKET
# Convert MongoDB data into JSON-friendly data
# ==========================================

def serialize_ticket(ticket):

    return {
        "id": str(ticket["_id"]),
        "ticket_number": ticket["ticket_number"],
        "subject": ticket["subject"],
        "category": ticket["category"],
        "description": ticket["description"],
        "created_by": ticket["created_by"],
        "created_by_name": ticket["created_by_name"],
        "created_by_email": ticket["created_by_email"],
        "employee_id": (
            str(ticket["employee_id"])
            if ticket.get("employee_id")
            else None
        ),
        "status": ticket["status"],
        "priority": ticket["priority"],
        "attachments": ticket.get("attachments", []),
        "replies": ticket.get("replies", []),
        "created_at": ticket["created_at"].isoformat(),
        "updated_at": ticket["updated_at"].isoformat()
    }


# ==========================================
# GENERATE UNIQUE TICKET NUMBER
# ==========================================

def generate_ticket_number():

    counter = counters.find_one_and_update(
        {"_id": "ticket_counter"},
        {"$inc": {"sequence": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )

    sequence = counter["sequence"]

    return f"OMNI-{sequence:05d}"


# ==========================================
# CREATE TICKET
# ==========================================

def create_ticket(ticket_data, current_user):

    # Find employee profile
    employee = employees.find_one({
        "user_id": str(current_user["_id"])
    })

    if current_user.get("role") == "employee" and not employee:
        raise ValueError("Employee profile not found")

    now = datetime.now(timezone.utc)

    ticket = {
        "ticket_number": generate_ticket_number(),

        "subject": ticket_data.subject,
        "category": ticket_data.category,
        "description": ticket_data.description,

        "created_by": str(current_user["_id"]),
        "created_by_name": current_user.get("name", ""),
        "created_by_email": current_user.get("email", ""),

        "employee_id": employee["_id"] if employee else None,

        "status": "Open",
        "priority": "Medium",

        "attachments": [],
        "replies": [],

        "created_at": now,
        "updated_at": now
    }

    result = tickets.insert_one(ticket)

    saved_ticket = tickets.find_one({
        "_id": result.inserted_id
    })

    return serialize_ticket(saved_ticket)


# ==========================================
# GET TICKETS
# Admin: All tickets
# Employee: Own tickets only
# ==========================================

def get_tickets(current_user):

    if current_user.get("role") == "admin":

        records = tickets.find().sort(
            "created_at",
            -1
        )

    else:

        records = tickets.find({
            "created_by": str(current_user["_id"])
        }).sort(
            "created_at",
            -1
        )

    return [
        serialize_ticket(ticket)
        for ticket in records
    ]


# ==========================================
# GET SINGLE TICKET
# ==========================================

def get_ticket_by_id(ticket_id, current_user):

    if not ObjectId.is_valid(ticket_id):
        return None

    ticket = tickets.find_one({
        "_id": ObjectId(ticket_id)
    })

    if not ticket:
        return None

    # Employee can access only their own ticket
    if current_user.get("role") == "employee":

        if ticket["created_by"] != str(current_user["_id"]):
            return None

    return serialize_ticket(ticket)


# ==========================================
# UPDATE TICKET
# Admin only - route must enforce admin access
# ==========================================

def update_ticket(ticket_id, update_data):

    if not ObjectId.is_valid(ticket_id):
        return None

    update_fields = update_data.model_dump(
        exclude_unset=True,
        exclude_none=True
    )

    if not update_fields:
        return None

    update_fields["updated_at"] = datetime.now(timezone.utc)

    result = tickets.update_one(
        {"_id": ObjectId(ticket_id)},
        {"$set": update_fields}
    )

    if result.matched_count == 0:
        return None

    updated_ticket = tickets.find_one({
        "_id": ObjectId(ticket_id)
    })

    return serialize_ticket(updated_ticket)


# ==========================================
# ADD TICKET REPLY
# ==========================================

def add_ticket_reply(ticket_id, reply_data, current_user):

    if not ObjectId.is_valid(ticket_id):
        return None

    ticket = tickets.find_one({
        "_id": ObjectId(ticket_id)
    })

    if not ticket:
        return None

    # Employee can reply only to their own ticket
    if current_user.get("role") == "employee":

        if ticket["created_by"] != str(current_user["_id"]):
            return None

        if ticket["status"] in ["Resolved", "Closed"]:
            raise ValueError("This ticket is already closed")

    reply = {
        "user_id": str(current_user["_id"]),
        "name": current_user.get("name", ""),
        "role": current_user.get("role"),
        "message": reply_data.message,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    tickets.update_one(
        {"_id": ObjectId(ticket_id)},
        {
            "$push": {"replies": reply},
            "$set": {
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )

    updated_ticket = tickets.find_one({
        "_id": ObjectId(ticket_id)
    })

    return serialize_ticket(updated_ticket)
