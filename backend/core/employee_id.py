
from pymongo import ReturnDocument

from database.connection import counters


def generate_employee_id(session=None):

    counter = counters.find_one_and_update(
        {"_id": "employee_id"},
        {
            "$inc": {"sequence": 1},
            "$setOnInsert": {
                "created_at": None
            }
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
        session=session
    )

    if not counter or "sequence" not in counter:
        raise RuntimeError("Unable to generate employee ID")

    return f"EMP{counter['sequence']:03d}"
