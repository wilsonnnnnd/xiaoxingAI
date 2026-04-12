from fastapi import APIRouter, HTTPException

from app.core import config as app_config
from app.core.llm import call_llm
from app.skills.gmail.pipeline import analyze_email, process_email, summarize_email
from app.skills.gmail.schemas import EmailRequest

router = APIRouter()


@router.get("/ai/ping")
def ai_ping():
    """测试 LLM 连接：发送最小 prompt，验证 API 可达且返回正常"""
    try:
        reply, _ = call_llm("Reply with the single word: pong", max_tokens=10)
        return {"ok": True, "backend": app_config.LLM_BACKEND, "reply": reply.strip()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/ai/analyze")
def ai_analyze(payload: EmailRequest):
    try:
        result = analyze_email(payload.subject, payload.body)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"analyze failed: {str(e)}")


@router.post("/ai/summary")
def ai_summary(payload: EmailRequest):
    try:
        analysis = analyze_email(payload.subject, payload.body)
        result = summarize_email(payload.subject, payload.body, analysis["result"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"summary failed: {str(e)}")


@router.post("/ai/process")
def ai_process(payload: EmailRequest):
    """完整流程：分析 → 摘要 → 生成 Telegram 通知"""
    try:
        result = process_email(payload.subject, payload.body)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"process failed: {str(e)}")

