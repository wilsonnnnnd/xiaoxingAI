import sys
import os
import json
from pprint import pprint

# ensure project root is importable
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from main_chat import load_system_prompt, call_xiaoxing_ai
from function.nlp.tone_analyzer import analyze_tone
from function.log import api_logger, logging_helpers
from function.audio import play_text_as_audio
from db.connection import get_connection
from config.config import PROMPT_PATH


def run_test(user_input: str):
    print('Running integration test...')
    system_prompt = load_system_prompt(PROMPT_PATH)
    prompt = (system_prompt.strip() + "\n用户：" + user_input + "\n小星：").strip()

    # call model
    try:
        reply = call_xiaoxing_ai(prompt)
    except Exception as e:
        print('AI call failed:', e)
        return

    print('\nAI reply:')
    print(reply)

    # analyze tone
    try:
        tone_info = analyze_tone(reply)
    except Exception as e:
        tone_info = None
        print('Tone analysis failed:', e)

    print('\nTone info:')
    pprint(tone_info)

    # write api_call record
    try:
        status = 'ok'
        if isinstance(reply, str) and reply.startswith('[ERROR]'):
            status = 'error'
        metadata = {'tone': tone_info} if tone_info else None
        api_logger.log_api_call(
            user_input=user_input,
            prompt=prompt,
            response=reply,
            response_tokens=None,
            model=None,
            duration_ms=None,
            status=status,
            metadata=metadata,
        )
    except Exception as e:
        print('Failed to write api_call:', e)

    # play as audio and pass tone as emotion
    try:
        emotion = tone_info.get('tone') if isinstance(tone_info, dict) else None
        play_text_as_audio(reply, emotion=emotion)
    except Exception as e:
        print('Audio playback failed:', e)

    # fetch latest api_calls and audio_usage rows
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute('SELECT id, user_input, response, duration_ms, status, metadata FROM api_calls ORDER BY id DESC LIMIT 1')
        api_row = cur.fetchone()
        cur.execute('SELECT id, text, duration_ms, voice, file_path, length_bytes, metadata FROM audio_usage ORDER BY id DESC LIMIT 1')
        audio_row = cur.fetchone()
        cur.close()
        conn.close()

        print('\nLatest api_calls row:')
        if api_row:
            try:
                meta = api_row[5]
                meta_parsed = json.loads(meta) if isinstance(meta, str) else meta
            except Exception:
                meta_parsed = api_row[5]
            pprint({
                'id': api_row[0], 'user_input': api_row[1], 'response': api_row[2], 'duration_ms': api_row[3], 'status': api_row[4], 'metadata': meta_parsed
            })
        else:
            print('No api_calls rows')

        print('\nLatest audio_usage row:')
        if audio_row:
            try:
                meta = audio_row[6]
                meta_parsed = json.loads(meta) if isinstance(meta, str) else meta
            except Exception:
                meta_parsed = audio_row[6]
            pprint({
                'id': audio_row[0], 'text': audio_row[1], 'duration_ms': audio_row[2], 'voice': audio_row[3], 'file_path': audio_row[4], 'length_bytes': audio_row[5], 'metadata': meta_parsed
            })
        else:
            print('No audio_usage rows')

    except Exception as e:
        print('DB query failed:', e)


if __name__ == '__main__':
    test_input = '你好，我想了解你今天过得怎么样。'
    run_test(test_input)
