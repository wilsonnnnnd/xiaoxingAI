import requests
import json
import sys
import time
from typing import Optional

from config.config import API_URL, PROMPT_PATH
from function.log import api_logger, logging_helpers
from function.audio import play_text_as_audio
from function.nlp.tone_analyzer import analyze_tone


def load_system_prompt(path: str) -> str:
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except Exception:
        return ""


def call_xiaoxing_ai(prompt_text: str) -> str:
    try:
        resp = requests.post(
            API_URL,
            json={
                "prompt": prompt_text,
                "n_predict": 256,
                "temperature": 0.7,
                "top_k": 50,
                "top_p": 0.9,
                "repeat_penalty": 1.1,
                "stop": ["用户："]
            },
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("content") or (data.get("choices") and data["choices"][0].get("text")) or ""

    except Exception as e:
        err = f"[ERROR] Failed to call Xiaoxing AI: {e}"
        try:
            logging_helpers.log("error", "AI call failed", {"error": str(e)})
        except Exception:
            pass
        return err


def main():
    system_prompt = load_system_prompt(PROMPT_PATH)
    # ensure stdout can print UTF-8 on Windows consoles
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    print("Xiaoxing (minimal) started. Type 'exit' to quit.")

    try:
        while True:
            user_input = input("You: ").strip()
            if not user_input:
                continue
            if user_input.lower() in ("exit", "quit", "退出"):
                print("Goodbye.")
                break

            prompt = (system_prompt.strip() + "\n用户：" + user_input + "\n小星：").strip()

            start = time.time()
            reply = call_xiaoxing_ai(prompt)
            duration_ms = int((time.time() - start) * 1000)
            print("Xiaoxing:", reply)

            # analyze tone using the AI model (best-effort)
            tone_info = None
            try:
                tone_info = analyze_tone(reply)
            except Exception as e:
                try:
                    logging_helpers.log("error", "Tone analysis failed", {"error": str(e)})
                except Exception:
                    pass

            # try to log API call to DB (best-effort) with tone metadata
            try:
                status = "ok"
                if isinstance(reply, str) and reply.startswith("[ERROR]"):
                    status = "error"
                metadata = {"tone": tone_info} if tone_info else None
                api_logger.log_api_call(
                    user_input=user_input,
                    prompt=prompt,
                    response=reply,
                    response_tokens=None,
                    model=None,
                    duration_ms=duration_ms,
                    status=status,
                    metadata=metadata,
                )
            except Exception as e:
                try:
                    logging_helpers.log("error", "Failed to write api_call", {"error": str(e)})
                except Exception:
                    pass

            # play reply as audio (best-effort) -- pass tone as emotion to select voice
            try:
                emotion = None
                if isinstance(tone_info, dict):
                    emotion = tone_info.get("tone")
                play_text_as_audio(reply, emotion=emotion)
            except Exception as e:
                try:
                    logging_helpers.log("error", "Audio playback failed", {"error": str(e)})
                except Exception:
                    pass

    except (KeyboardInterrupt, EOFError):
        print("\nInterrupted, exiting.")
        sys.exit(0)


if __name__ == "__main__":
    main()
