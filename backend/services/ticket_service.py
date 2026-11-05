
import re

from datetime import datetime, timezone

from bson import ObjectId
from pymongo import ReturnDocument

from database.connection import (
    tickets,
    counters,
    employees,
    users
)


# ==========================================
# DATETIME HELPER
# ==========================================

def format_datetime(value):

    if hasattr(value, "isoformat"):
        return value.isoformat()

    return value


# ==========================================
# ACTIVITY HISTORY HELPER
# ==========================================

def create_activity(
    action,
    description,
    performed_by,
    role
):

    return {
        "action": action,
        "description": description,
        "performed_by": str(performed_by.get("_id", "system")),
        "performed_by_name": performed_by.get("name", "System"),
        "performed_by_role": role,
        "created_at": datetime.now(timezone.utc).isoformat()
    }


def add_ticket_activity(ticket_id, activity):

    if not ObjectId.is_valid(str(ticket_id)):
        return False

    result = tickets.update_one(
        {"_id": ObjectId(ticket_id)},
        {
            "$push": {
                "activities": activity
            },
            "$set": {
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )

    return result.modified_count == 1


# ==========================================
# SERIALIZE TICKET
# ==========================================

def serialize_ticket(ticket):

    if not ticket:
        return None

    attachments = []

    for attachment in ticket.get("attachments", []):

        # Do not expose internal stored filename
        safe_attachment = {
            key: value
            for key, value in attachment.items()
            if key not in {
                "stored_filename",
                "file_path"
            }
        }

        attachments.append(safe_attachment)

    return {
        "id": str(ticket["_id"]),
        "ticket_number": ticket.get("ticket_number"),
        "subject": ticket.get("subject"),
        "category": ticket.get("category"),
        "description": ticket.get("description"),

        "created_by": ticket.get("created_by"),
        "created_by_name": ticket.get("created_by_name"),
        "created_by_email": ticket.get("created_by_email"),

        "employee_id": (
            str(ticket["employee_id"])
            if ticket.get("employee_id")
            else None
        ),

        "assigned_to": ticket.get("assigned_to"),
        "assigned_to_name": ticket.get("assigned_to_name"),
        "assigned_at": format_datetime(
            ticket.get("assigned_at")
        ),

        "status": ticket.get("status"),
        "priority": ticket.get("priority"),

        "attachments": attachments,
        "replies": ticket.get("replies", []),
        "activities": ticket.get("activities", []),

        "created_at": format_datetime(
            ticket.get("created_at")
        ),

        "updated_at": format_datetime(
            ticket.get("updated_at")
        )
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

    if not counter or "sequence" not in counter:
        raise RuntimeError("Unable to generate ticket number")

    sequence = counter["sequence"]

    return f"OMNI-{sequence:05d}"


# ==========================================
# CREATE TICKET
# Employee raises ticket
# Automatically assigned to Admin
# ==========================================

def create_ticket(ticket_data, current_user):

    if current_user.get("role") != "employee":
        raise ValueError(
            "Only employees can raise support tickets"
        )

    employee = employees.find_one({
        "user_id": str(current_user["_id"])
    })

    if not employee:
        raise ValueError("Employee profile not found")

    if employee.get("employment_status") != "Active":
        raise ValueError("Employee account is inactive")

    admin = users.find_one({
        "role": "admin",
        "status": "approved"
    })

    if not admin:
        raise ValueError(
            "No active Admin is available to handle this ticket"
        )

    now = datetime.now(timezone.utc)

    ticket_number = generate_ticket_number()

    ticket = {
        "ticket_number": ticket_number,

        "subject": ticket_data.subject,
        "category": ticket_data.category,
        "description": ticket_data.description,

        "created_by": str(current_user["_id"]),
        "created_by_name": current_user.get("name", ""),
        "created_by_email": current_user.get("email", ""),

        "employee_id": employee["_id"],

        "assigned_to": str(admin["_id"]),
        "assigned_to_name": admin.get("name", ""),
        "assigned_at": now,

        "status": "Open",
        "priority": "Medium",

        "attachments": [],
        "replies": [],

        "activities": [
            {
                "action": "ticket_created",
                "description": "Support ticket created",
                "performed_by": str(current_user["_id"]),
                "performed_by_name": current_user.get("name", ""),
                "performed_by_role": "employee",
                "created_at": now.isoformat()
            },
            {
                "action": "ticket_assigned",
                "description": (
                    f"Ticket automatically assigned to "
                    f"{admin.get('name', 'Admin')}"
                ),
                "performed_by": "system",
                "performed_by_name": "System",
                "performed_by_role": "system",
                "created_at": now.isoformat()
            }
        ],

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

    elif current_user.get("role") == "employee":

        records = tickets.find({
            "created_by": str(current_user["_id"])
        }).sort(
            "created_at",
            -1
        )

    else:
        return []

    return [
        serialize_ticket(ticket)
        for ticket in records
    ]


# ==========================================
# ADMIN TICKET FILTERING AND SEARCH
# ==========================================

def filter_admin_tickets(
    status=None,
    priority=None,
    category=None,
    search=None,
    sort_order="newest",
    page=1,
    page_size=10
):

    query = {}

    if status:
        query["status"] = status

    if priority:
        query["priority"] = priority

    if category:
        query["category"] = category

    if search:

        search_pattern = re.escape(search.strip())

        query["$or"] = [
            {
                "ticket_number": {
                    "$regex": search_pattern,
                    "$options": "i"
                }
            },
            {
                "subject": {
                    "$regex": search_pattern,
                    "$options": "i"
                }
            },
            {
                "created_by_name": {
                    "$regex": search_pattern,
                    "$options": "i"
                }
            },
            {
                "created_by_email": {
                    "$regex": search_pattern,
                    "$options": "i"
                }
            }
        ]

    sort_direction = (
        1 if sort_order == "oldest" else -1
    )

    total = tickets.count_documents(query)

    skip = (page - 1) * page_size

    records = tickets.find(query).sort(
        "created_at",
        sort_direction
    ).skip(skip).limit(page_size)

    ticket_list = [
        serialize_ticket(ticket)
        for ticket in records
    ]

    total_pages = (
        (total + page_size - 1) // page_size
    )

    return {
        "tickets": ticket_list,
        "pagination": {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages
        }
    }


# ==========================================
# ADMIN DASHBOARD TICKET STATISTICS
# ==========================================

def get_ticket_statistics():

    total_tickets = tickets.count_documents({})

    status_counts = {
        "Open": tickets.count_documents({
            "status": "Open"
        }),

        "In Progress": tickets.count_documents({
            "status": "In Progress"
        }),

        "Resolved": tickets.count_documents({
            "status": "Resolved"
        }),

        "Closed": tickets.count_documents({
            "status": "Closed"
        })
    }

    priority_counts = {
        "Low": tickets.count_documents({
            "priority": "Low"
        }),

        "Medium": tickets.count_documents({
            "priority": "Medium"
        }),

        "High": tickets.count_documents({
            "priority": "High"
        }),

        "Urgent": tickets.count_documents({
            "priority": "Urgent"
        })
    }

    category_counts = {
        "Technical": tickets.count_documents({
            "category": "Technical"
        }),

        "Documents": tickets.count_documents({
            "category": "Documents"
        }),

        "Profile": tickets.count_documents({
            "category": "Profile"
        }),

        "Account": tickets.count_documents({
            "category": "Account"
        }),

        "Other": tickets.count_documents({
            "category": "Other"
        })
    }

    return {
        "total_tickets": total_tickets,
        "status_counts": status_counts,
        "priority_counts": priority_counts,
        "category_counts": category_counts
    }


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

    if current_user.get("role") == "employee":

        if ticket.get("created_by") != str(current_user["_id"]):
            return None

    elif current_user.get("role") != "admin":

        return None

    return serialize_ticket(ticket)


# ==========================================
# UPDATE TICKET
# Admin only
# Tracks status and priority changes
# ==========================================

def update_ticket(ticket_id, update_data, current_user):

    if current_user.get("role") != "admin":
        return None

    if not ObjectId.is_valid(ticket_id):
        return None

    ticket_object_id = ObjectId(ticket_id)

    existing_ticket = tickets.find_one({
        "_id": ticket_object_id
    })

    if not existing_ticket:
        return None

    update_fields = update_data.model_dump(
        exclude_unset=True,
        exclude_none=True
    )

    if not update_fields:
        return None

    now = datetime.now(timezone.utc)

    activities = []

    if (
        "status" in update_fields
        and update_fields["status"] != existing_ticket.get("status")
    ):

        activities.append(
            create_activity(
                "status_changed",
                (
                    f"Status changed from "
                    f"{existing_ticket.get('status')} "
                    f"to {update_fields['status']}"
                ),
                current_user,
                "admin"
            )
        )

    if (
        "priority" in update_fields
        and update_fields["priority"] != existing_ticket.get("priority")
    ):

        activities.append(
            create_activity(
                "priority_changed",
                (
                    f"Priority changed from "
                    f"{existing_ticket.get('priority')} "
                    f"to {update_fields['priority']}"
                ),
                current_user,
                "admin"
            )
        )

    update_fields["updated_at"] = now

    update_query = {
        "$set": update_fields
    }

    if activities:

        update_query["$push"] = {
            "activities": {
                "$each": activities
            }
        }

    result = tickets.update_one(
        {"_id": ticket_object_id},
        update_query
    )

    if result.matched_count == 0:
        return None

    updated_ticket = tickets.find_one({
        "_id": ticket_object_id
    })

    return serialize_ticket(updated_ticket)


# ==========================================
# ADD TICKET REPLY
# Employee and Admin
# ==========================================

def add_ticket_reply(ticket_id, reply_data, current_user):

    if not ObjectId.is_valid(ticket_id):
        return None

    ticket_object_id = ObjectId(ticket_id)

    ticket = tickets.find_one({
        "_id": ticket_object_id
    })

    if not ticket:
        return None

    role = current_user.get("role")

    if role == "employee":

        if ticket.get("created_by") != str(current_user["_id"]):
            return None

        if ticket.get("status") in ["Resolved", "Closed"]:
            raise ValueError("This ticket is already closed")

    elif role != "admin":

        return None

    now = datetime.now(timezone.utc)

    reply = {
        "user_id": str(current_user["_id"]),
        "name": current_user.get("name", ""),
        "role": role,
        "message": reply_data.message,
        "created_at": now.isoformat()
    }

    activity = create_activity(
        "reply_added",
        f"{current_user.get('name', 'User')} added a reply",
        current_user,
        role
    )

    update_filter = {
        "_id": ticket_object_id
    }

    if role == "employee":
        update_filter["status"] = {
            "$nin": ["Resolved", "Closed"]
        }

    result = tickets.update_one(
        update_filter,
        {
            "$push": {
                "replies": reply,
                "activities": activity
            },
            "$set": {
                "updated_at": now
            }
        }
    )

    if result.modified_count == 0:

        if role == "employee":
            raise ValueError("This ticket is already closed")

        return None

    updated_ticket = tickets.find_one({
        "_id": ticket_object_id
    })

    return serialize_ticket(updated_ticket)


# ==========================================
# ADD TICKET ATTACHMENT
# ==========================================

def add_ticket_attachment(
    ticket_id,
    attachment_data,
    current_user
):

    if not ObjectId.is_valid(ticket_id):
        return None

    ticket_object_id = ObjectId(ticket_id)

    ticket = tickets.find_one({
        "_id": ticket_object_id
    })

    if not ticket:
        return None

    role = current_user.get("role")

    if role == "employee":

        if ticket.get("created_by") != str(current_user["_id"]):
            return None

        if ticket.get("status") in ["Resolved", "Closed"]:
            raise ValueError(
                "Cannot attach files to a closed ticket"
            )

    elif role != "admin":

        return None

    now = datetime.now(timezone.utc)

    attachment_data = {
        **attachment_data,
        "uploaded_by": str(current_user["_id"]),
        "uploaded_at": now.isoformat()
    }

    activity = create_activity(
        "attachment_uploaded",
        (
            f"{current_user.get('name', 'User')} uploaded "
            f"{attachment_data.get('file_name', 'an attachment')}"
        ),
        current_user,
        role
    )

    update_filter = {
        "_id": ticket_object_id
    }

    if role == "employee":
        update_filter["status"] = {
            "$nin": ["Resolved", "Closed"]
        }

    update_result = tickets.update_one(
        update_filter,
        {
            "$push": {
                "attachments": attachment_data,
                "activities": activity
            },
            "$set": {
                "updated_at": now
            }
        }
    )

    if update_result.modified_count == 0:

        if role == "employee":
            raise ValueError(
                "Cannot attach files to a closed ticket"
            )

        return None

    updated_ticket = tickets.find_one({
        "_id": ticket_object_id
    })

    return serialize_ticket(updated_ticket)


# ==========================================
# GET TICKET ATTACHMENT
# ==========================================

def get_ticket_attachment(
    ticket_id,
    attachment_id,
    current_user
):

    if not ObjectId.is_valid(ticket_id):
        return None

    ticket = tickets.find_one({
        "_id": ObjectId(ticket_id)
    })

    if not ticket:
        return None

    role = current_user.get("role")

    if role == "employee":

        if ticket.get("created_by") != str(current_user["_id"]):
            return None

    elif role != "admin":

        return None

    for attachment in ticket.get("attachments", []):

        if attachment.get("attachment_id") == attachment_id:
            return attachment

    return None
