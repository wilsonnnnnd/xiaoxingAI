from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import time
from typing import Optional, Dict, Any

from main_chat import load_system_prompt, call_xiaoxing_ai
from function.log import api_logger, logging_helpers
from function.audio import play_text_as_audio
from function.nlp.tone_analyzer import analyze_tone
from config.config import PROMPT_PATH

app = FastAPI(title="Xiaoxing API")

_system_prompt = None

def _get_system_prompt():
    global _system_prompt
    if _system_prompt is None:
        _system_prompt = load_system_prompt(PROMPT_PATH)
    return _system_prompt


class ChatRequest(BaseModel):
    user_input: str
    play_audio: Optional[bool] = False
    emotion: Optional[str] = None


class ChatResponse(BaseModel):
    ok: bool
    response: str
    duration_ms: int
    tone: Optional[Dict[str, Any]] = None
    audio_played: Optional[bool] = None


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/v1/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    system_prompt = _get_system_prompt() or ""
    prompt = (system_prompt.strip() + "\n用户：" + req.user_input + "\n小星：").strip()

    start = time.time()
    try:
        reply = call_xiaoxing_ai(prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI call failed: {e}")
    duration_ms = int((time.time() - start) * 1000)

    # tone analysis (best-effort)
    tone_info = None
    try:
        tone_info = analyze_tone(reply)
    except Exception:
        tone_info = None

    # log api call (best-effort)
    try:
        status = "ok"
        if isinstance(reply, str) and reply.startswith("[ERROR]"):
            status = "error"
        metadata = {"tone": tone_info} if tone_info else None
        api_logger.log_api_call(
            user_input=req.user_input,
            prompt=prompt,
            response=reply,
            response_tokens=None,
            model=None,
            duration_ms=duration_ms,
            status=status,
            metadata=metadata,
        )
    except Exception:
        try:
            logging_helpers.log("error", "Failed to write api_call", {})
        except Exception:
            pass

    audio_played = None
    if req.play_audio:
        try:
            emotion = req.emotion or (tone_info.get("tone") if isinstance(tone_info, dict) else None)
            play_text_as_audio(reply, emotion=emotion)
            audio_played = True
        except Exception:
            audio_played = False

    return ChatResponse(ok=True, response=reply, duration_ms=duration_ms, tone=tone_info, audio_played=audio_played)


if __name__ == "__main__":
    # Allow running the API server directly: `python api_server.py`
    try:
        import uvicorn

        uvicorn.run("api_server:app", host="127.0.0.1", port=8001, reload=True)
    except Exception as e:
        print("Failed to start server via uvicorn:", e)
