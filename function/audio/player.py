import asyncio
import time
import sys
from typing import Optional, Dict, Any

from function.audio.speech_utils import speak
from function.log import tone_logger


def play_text_as_audio(text: str, emotion: Optional[str] = None) -> Dict[str, Any]:
    """Play `text` as audio using existing `speak` and log usage.

    Returns a dict with playback metadata.
    """
    # base config defaults
    voice = None
    style = None
    rate = None
    volume = None

    # simple tone -> voice/style mapping to vary voice characteristics
    if emotion:
        tone_map = {
            "joyful": {"voice": "zh-CN-XiaoxiaoNeural", "style": "cheerful"},
            "excited": {"voice": "zh-CN-XiaoxiaoNeural", "style": "cheerful"},
            "positive": {"voice": "zh-CN-XiaoxiaoNeural", "style": "friendly"},
            "negative": {"voice": "zh-CN-YunfengNeural", "style": "sad"},
            "angry": {"voice": "zh-CN-YunfengNeural", "style": "angry"},
            "sad": {"voice": "zh-CN-YunxiNeural", "style": "sad"},
            "calm": {"voice": "zh-CN-YunxiNeural", "style": "calm"},
            "formal": {"voice": "zh-CN-YunxiNeural", "style": "formal"},
            "informal": {"voice": "zh-CN-XiaoxiaoNeural", "style": "chat"},
            "polite": {"voice": "zh-CN-XiaoxiaoNeural", "style": "polite"},
        }
        m = tone_map.get(emotion)
        if m:
            # apply overrides if present
            if "voice" in m and m["voice"]:
                voice = m["voice"]
            if "style" in m and m["style"]:
                style = m["style"]
            if "rate" in m and m["rate"]:
                rate = m["rate"]
            if "volume" in m and m["volume"]:
                volume = m["volume"]

    start = time.time()
    try:
        # Ensure stdout uses utf-8 while running TTS to avoid Windows cp1252 encode errors
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

        # `speak` is async; run it synchronously here
        # `speak` returns the new audio_id when logging succeeded
        audio_id = asyncio.run(speak(text, voice=voice, style=style, rate=rate, volume=volume))
        # if caller provided an emotion/tone, persist a tone row linked to this audio
        try:
            if audio_id is not None and emotion:
                # score is unknown here; store tone string and timestamp in metadata
                tone_logger.log_tone(audio_id, emotion, score=None, metadata={"source": "player", "noted_at": time.time()})
        except Exception:
            pass
        duration_ms = int((time.time() - start) * 1000)
        return {"ok": True, "duration_ms": duration_ms, "audio_id": audio_id}
    except Exception as e:
        duration_ms = int((time.time() - start) * 1000)
        # speak() should have logged the error; return failure status
        return {"ok": False, "error": str(e), "duration_ms": duration_ms}
