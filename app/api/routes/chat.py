from fastapi import APIRouter, Depends
from app.core import auth as auth_mod
from app.schemas import ChatPersonaRequest
from app.services.persona_prompt_service import PersonaPromptService

router = APIRouter()

@router.post("/chat/generate_persona_prompt")
def chat_generate_persona_prompt(payload: ChatPersonaRequest, user: dict = Depends(auth_mod.current_user)):
    """
    四阶段 AI 聊天提示词生成流水线。
    """
    service = PersonaPromptService()
    return service.generate(payload)
