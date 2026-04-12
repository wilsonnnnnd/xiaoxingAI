from fastapi import APIRouter, Depends

from app.core import auth as auth_mod
from app.schemas import OutgoingComposeRequest, OutgoingComposeResponse
from app.services.outgoing_email_service import OutgoingEmailService


router = APIRouter(tags=["Gmail"])


@router.post("/gmail/compose", response_model=OutgoingComposeResponse)
def gmail_compose(
    payload: OutgoingComposeRequest,
    user=Depends(auth_mod.current_user),
):
    service = OutgoingEmailService()
    return service.compose(payload=payload, user=user)

