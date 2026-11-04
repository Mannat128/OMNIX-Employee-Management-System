
from fastapi import APIRouter, Depends, HTTPException, status

from dependencies.auth import (
    require_password_changed,
    require_admin
)

from models.ticket import (
    TicketCreate,
    TicketUpdate,
    TicketReply
)

from services.ticket_service import (
    create_ticket,
    get_tickets,
    get_ticket_by_id,
    update_ticket,
    add_ticket_reply
)


router = APIRouter()


# ==========================================
# CREATE TICKET
# Employee can raise a support ticket
# ==========================================

@router.post("/", status_code=status.HTTP_201_CREATED)
def raise_ticket(
    ticket_data: TicketCreate,
    current_user: dict = Depends(require_password_changed)
):

    if current_user.get("role") != "employee":
        raise HTTPException(
            status_code=403,
            detail="Only employees can raise support tickets"
        )

    try:
        return {
            "message": "Support ticket created successfully",
            "ticket": create_ticket(ticket_data, current_user)
        }

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


# ==========================================
# GET ALL TICKETS
# Admin: All tickets
# Employee: Own tickets
# ==========================================

@router.get("/")
def list_tickets(
    current_user: dict = Depends(require_password_changed)
):

    return get_tickets(current_user)


# ==========================================
# GET SINGLE TICKET
# ==========================================

@router.get("/{ticket_id}")
def ticket_details(
    ticket_id: str,
    current_user: dict = Depends(require_password_changed)
):

    ticket = get_ticket_by_id(
        ticket_id,
        current_user
    )

    if not ticket:
        raise HTTPException(
            status_code=404,
            detail="Ticket not found"
        )

    return ticket


# ==========================================
# UPDATE TICKET
# Admin only
# ==========================================

@router.patch("/{ticket_id}")
def modify_ticket(
    ticket_id: str,
    update_data: TicketUpdate,
    current_user: dict = Depends(require_admin)
):

    ticket = update_ticket(
        ticket_id,
        update_data
    )

    if not ticket:
        raise HTTPException(
            status_code=404,
            detail="Ticket not found or no valid updates provided"
        )

    return {
        "message": "Ticket updated successfully",
        "ticket": ticket
    }


# ==========================================
# REPLY TO TICKET
# Employee and Admin
# ==========================================

@router.post("/{ticket_id}/replies")
def reply_to_ticket(
    ticket_id: str,
    reply_data: TicketReply,
    current_user: dict = Depends(require_password_changed)
):

    try:
        ticket = add_ticket_reply(
            ticket_id,
            reply_data,
            current_user
        )

        if not ticket:
            raise HTTPException(
                status_code=404,
                detail="Ticket not found"
            )

        return {
            "message": "Reply added successfully",
            "ticket": ticket
        }

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )
