from fastapi import APIRouter
from app.api.http import run_http

from app.core import config as app_config
from app.core.llm import call_llm
from app.domains.gmail.pipeline import analyze_email, process_email, summarize_email
from app.domains.gmail.schemas import EmailRequest

router = APIRouter()


@router.get("/ai/ping")
def ai_ping():
    """测试 LLM 连接：发送最小 prompt，验证 API 可达且返回正常"""
    def _run():
        reply, _ = call_llm("Reply with the single word: pong", max_tokens=10)
        return {"ok": True, "backend": app_config.LLM_BACKEND, "reply": reply.strip()}

    return run_http(_run, error_status=502)


@router.post("/ai/analyze")
def ai_analyze(payload: EmailRequest):
    return run_http(
        lambda: analyze_email(payload.subject, payload.body, snippet=(payload.body or "")[:400]),
        error_prefix="analyze failed",
    )


@router.post("/ai/summary")
def ai_summary(payload: EmailRequest):
    def _run():
        body = payload.body or ""
        analysis = analyze_email(payload.subject, body, snippet=body[:400])
        return summarize_email(payload.subject, analysis["result"], snippet=body[:400], body_excerpt=body[:1200])

    return run_http(_run, error_prefix="summary failed")


@router.post("/ai/process")
def ai_process(payload: EmailRequest):
    """完整流程：分析 → 摘要 → 生成 Telegram 通知"""
    return run_http(lambda: process_email(payload.subject, payload.body), error_prefix="process failed")
