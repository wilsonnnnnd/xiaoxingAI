import asyncio
import time
import sys
from typing import Optional, Dict, Any

from function.audio.speech_utils import speak
from function.audio.speech_config_db import get_speech_config
from db import audio_logger


def play_text_as_audio(text: str, emotion: Optional[str] = None) -> Dict[str, Any]:
    """Play `text` as audio using existing `speak` and log usage.

    Returns a dict with playback metadata.
    """
    # choose speech config by emotion if provided
    cfg = get_speech_config(emotion) if emotion else get_speech_config(None)
    voice = cfg.get("voice") if cfg else None
    style = cfg.get("style") if cfg else None
    rate = cfg.get("rate") if cfg else None
    volume = cfg.get("volume") if cfg else None

    start = time.time()
    try:
        # Ensure stdout uses utf-8 while running TTS to avoid Windows cp1252 encode errors
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

        # `speak` is async; run it synchronously here
        asyncio.run(speak(text, voice=voice, style=style, rate=rate, volume=volume))
        duration_ms = int((time.time() - start) * 1000)
        # we don't have a file_path or length_bytes from speak; leave None
        audio_id = audio_logger.log_audio_usage(
            text=text,
            duration_ms=duration_ms,
            voice=voice,
            style=style,
            rate=rate,
            volume=volume,
            length_bytes=None,
            file_path=None,
            metadata=None,
        )
        return {"ok": True, "duration_ms": duration_ms, "audio_id": audio_id}
    except Exception as e:
        duration_ms = int((time.time() - start) * 1000)
        try:
            audio_logger.log_audio_usage(
                text=text,
                duration_ms=duration_ms,
                voice=voice,
                style=style,
                rate=rate,
                volume=volume,
                length_bytes=None,
                file_path=None,
                metadata={"error": str(e)} if e else None,
            )
        except Exception:
            pass
        return {"ok": False, "error": str(e), "duration_ms": duration_ms}
