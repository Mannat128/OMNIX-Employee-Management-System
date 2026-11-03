from pymongo import ReturnDocument

from database.connection import counters


def generate_employee_id():
    counter = counters.find_one_and_update(
        {"_id": "employee_id"},
        {
            "$inc": {"sequence": 1},
            "$setOnInsert": {"created_at": None}
        },
        upsert=True,
        return_document=ReturnDocument.AFTER
    )

    sequence = counter["sequence"]

    return f"EMP{sequence:03d}"