import os
import platform
import time
import queue
import threading
import re
import html
from datetime import datetime
import subprocess
from edge_tts import Communicate
from config.config import DEFAULT_RATE, DEFAULT_STYLE, DEFAULT_VOICE, DEFAULT_VOLUME, AUDIO_DIR, MIN_AUDIO_FILE_SIZE
from function.log import audio_logger
import shutil
import importlib
import ctypes

speak_queue = queue.Queue()
active_players = []


def _ensure_vlc_loaded(candidate_paths=None):
    try:
        import vlc
        return vlc
    except Exception:
        pass

    if candidate_paths is None:
        candidate_paths = []
    env_vlc = os.environ.get('VLC_PATH')
    if env_vlc:
        candidate_paths.append(env_vlc)
    pf = os.environ.get('ProgramFiles')
    pf86 = os.environ.get('ProgramFiles(x86)')
    if pf:
        candidate_paths.append(os.path.join(pf, 'VideoLAN', 'VLC'))
    if pf86:
        candidate_paths.append(os.path.join(pf86, 'VideoLAN', 'VLC'))
    candidate_paths.append(r'E:\Program Files (x86)\VideoLAN\VLC')

    for cand in candidate_paths:
        try:
            if not cand or not os.path.isdir(cand):
                continue
            try:
                if hasattr(os, 'add_dll_directory'):
                    os.add_dll_directory(cand)
            except Exception:
                pass
            try:
                import vlc
                return vlc
            except Exception:
                dll_path = os.path.join(cand, 'libvlc.dll')
                if os.path.exists(dll_path):
                    try:
                        ctypes.CDLL(dll_path)
                        import vlc
                        return vlc
                    except Exception:
                        pass
        except Exception:
            pass
    raise ImportError('python-vlc / libvlc not found')


def _player_cleaner():
    while True:
        try:
            for entry in list(active_players):
                try:
                    # entry is (player_obj, audio_id) when available
                    if isinstance(entry, tuple) and len(entry) == 2:
                        player_obj, audio_id = entry
                    else:
                        player_obj = entry
                        audio_id = None

                    # VLC player states
                    if hasattr(player_obj, 'get_state'):
                        try:
                            import vlc as _vlc
                            state = player_obj.get_state()
                            if state in (_vlc.State.Ended, _vlc.State.Error, _vlc.State.Stopped):
                                # playback finished -> record event
                                try:
                                    from function.log.audio_logger import update_audio_metadata
                                    from function.log.tone_logger import append_play_event
                                    played_at = datetime.utcnow().isoformat()
                                    if audio_id is not None:
                                        update_audio_metadata(audio_id, {"played": True, "played_at": played_at})
                                        append_play_event(audio_id, {"played": True, "played_at": played_at, "source": "player_cleaner"})
                                except Exception:
                                    pass
                                try:
                                    active_players.remove(entry)
                                except ValueError:
                                    pass
                                continue
                        except Exception:
                            pass

                    # simpleaudio / play objects
                    if hasattr(player_obj, 'is_playing'):
                        try:
                            playing = player_obj.is_playing()
                            if playing is False:
                                try:
                                    from function.log.audio_logger import update_audio_metadata
                                    from function.log.tone_logger import append_play_event
                                    played_at = datetime.utcnow().isoformat()
                                    if audio_id is not None:
                                        update_audio_metadata(audio_id, {"played": True, "played_at": played_at})
                                        append_play_event(audio_id, {"played": True, "played_at": played_at, "source": "player_cleaner"})
                                except Exception:
                                    pass
                                try:
                                    active_players.remove(entry)
                                except ValueError:
                                    pass
                                continue
                        except Exception:
                            try:
                                active_players.remove(entry)
                            except ValueError:
                                pass
                except Exception:
                    try:
                        active_players.remove(entry)
                    except ValueError:
                        pass
            time.sleep(2)
        except Exception:
            time.sleep(2)


def _start_speak_worker():
    def worker():
        while True:
            item = speak_queue.get()
            if not item:
                continue
            # item can be either a path (backwards compat) or (audio_id, path)
            if isinstance(item, tuple) and len(item) == 2:
                audio_id, audio_path = item
            else:
                audio_id = None
                audio_path = item
            try:
                system = platform.system()
                if system == 'Windows':
                    # 1) python-vlc
                    try:
                        vlc = _ensure_vlc_loaded()
                        instance = vlc.Instance('--intf', 'dummy', '--no-video')
                        media = instance.media_new(audio_path)
                        player = instance.media_player_new()
                        player.set_media(media)
                        player.play()
                        started_at = datetime.utcnow().isoformat()
                        active_players.append((player, audio_id, started_at))
                        continue
                    except Exception:
                        pass

                    # 2) pydub + simpleaudio
                    try:
                        from pydub import AudioSegment
                        import simpleaudio as sa
                        seg = AudioSegment.from_file(audio_path)
                        play_obj = sa.play_buffer(seg.raw_data, seg.channels, seg.sample_width, seg.frame_rate)
                        started_at = datetime.utcnow().isoformat()
                        active_players.append((play_obj, audio_id, started_at))
                        continue
                        continue
                    except Exception:
                        pass

                    # 3) ffplay / mpv
                    try:
                        ffplay = shutil.which('ffplay')
                        mpv = shutil.which('mpv')
                        if ffplay:
                            proc = subprocess.Popen([ffplay, '-nodisp', '-autoexit', '-loglevel', 'quiet', audio_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                            started_at = datetime.utcnow().isoformat()
                            active_players.append((proc, audio_id, started_at))
                            continue
                        elif mpv:
                            proc = subprocess.Popen([mpv, '--no-terminal', '--really-quiet', '--idle=no', audio_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                            started_at = datetime.utcnow().isoformat()
                            active_players.append((proc, audio_id, started_at))
                            continue
                    except Exception:
                        pass

                    # fallback: os.startfile
                    try:
                        # os.startfile doesn't give a handle; use subprocess start so we can track
                        proc = subprocess.Popen(f'start "" "{audio_path}"', shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                        started_at = datetime.utcnow().isoformat()
                        active_players.append((proc, audio_id, started_at))
                    except Exception:
                        try:
                            os.startfile(audio_path)
                        except Exception:
                            pass

                elif system == 'Darwin':
                    proc = subprocess.Popen(['afplay', audio_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    started_at = datetime.utcnow().isoformat()
                    active_players.append((proc, audio_id, started_at))
                else:
                    try:
                        proc = subprocess.Popen(['mpg123', audio_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                        started_at = datetime.utcnow().isoformat()
                        active_players.append((proc, audio_id, started_at))
                    except FileNotFoundError:
                        ffplay = shutil.which('ffplay')
                        mpv = shutil.which('mpv')
                        if ffplay:
                            proc = subprocess.Popen([ffplay, '-nodisp', '-autoexit', '-loglevel', 'quiet', audio_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                            started_at = datetime.utcnow().isoformat()
                            active_players.append((proc, audio_id, started_at))
                        elif mpv:
                            proc = subprocess.Popen([mpv, '--no-terminal', '--really-quiet', '--idle=no', audio_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                            started_at = datetime.utcnow().isoformat()
                            active_players.append((proc, audio_id, started_at))
                        else:
                            proc = subprocess.Popen(['xdg-open', audio_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                            started_at = datetime.utcnow().isoformat()
                            active_players.append((proc, audio_id, started_at))
            except Exception:
                pass
            finally:
                speak_queue.task_done()

    threading.Thread(target=_player_cleaner, daemon=True).start()
    threading.Thread(target=worker, daemon=True).start()


_start_speak_worker()


def build_ssml(text, voice, style, rate, volume):
    return f"""
        <speak version='1.0' xml:lang='zh-CN'>
        <voice name='{voice}' style='{style}'>
            <prosody rate='{rate}' volume='{volume}'>{text}</prosody>
        </voice>
        </speak>
        """


async def speak(text: str, voice=DEFAULT_VOICE, style=DEFAULT_STYLE, rate=DEFAULT_RATE, volume=DEFAULT_VOLUME, remove_brackets=True):
    original_text = text.strip()
    if remove_brackets:
        cleaned_text = re.sub(r"[{}]", "", original_text)
    else:
        cleaned_text = original_text

    safe_text = html.escape(cleaned_text)
    print(f"[🗣️ 合成语音] {cleaned_text}")

    start = time.time()
    try:
        # determine effective values: callers may pass None to indicate 'use defaults'
        used_voice = voice or DEFAULT_VOICE
        used_style = style or DEFAULT_STYLE
        used_rate = rate if rate is not None else DEFAULT_RATE
        used_volume = volume if volume is not None else DEFAULT_VOLUME

        ssml_text = build_ssml(safe_text, used_voice, used_style, used_rate, used_volume)
        os.makedirs(AUDIO_DIR, exist_ok=True)
        filename = f"output_{int(time.time() * 1000)}.mp3"
        output_path = os.path.join(AUDIO_DIR, filename)

        communicate = Communicate(cleaned_text, voice=used_voice)
        await communicate.save(output_path)

        if not os.path.exists(output_path) or os.path.getsize(output_path) < MIN_AUDIO_FILE_SIZE:
            print("⚠️ 合成失败或音频过小，自动跳过")
            # log failure to audio_usage
            try:
                duration_ms = int((time.time() - start) * 1000)
                audio_logger.log_audio_usage(
                    text=cleaned_text,
                    duration_ms=duration_ms,
                    voice=used_voice,
                    style=used_style,
                    rate=used_rate,
                    volume=used_volume,
                    length_bytes=None,
                    file_path=None,
                    metadata={"error": "audio missing or too small"},
                )
            except Exception:
                pass
            return

        size = os.path.getsize(output_path)
        duration_ms = int((time.time() - start) * 1000)

        # write usage log and return the new audio_id if available
        audio_id = None
        try:
            audio_id = audio_logger.log_audio_usage(
                    text=cleaned_text,
                    duration_ms=duration_ms,
                    voice=used_voice,
                    style=used_style,
                    rate=used_rate,
                    volume=used_volume,
                    length_bytes=size,
                    file_path=output_path,
                    metadata={"synthesized_at": datetime.utcnow().isoformat()},
                )
        except Exception:
            audio_id = None

        # enqueue a tuple so the play worker can log playback for this audio_id
        try:
            speak_queue.put((audio_id, output_path))
        except Exception:
            try:
                speak_queue.put(output_path)
            except Exception:
                pass

        print(f"[✅ 合成完成] 入队播放：{output_path}")

        return audio_id

    except Exception as e:
        print("[❌ 语音合成出错]", e)
        try:
            duration_ms = int((time.time() - start) * 1000)
            audio_logger.log_audio_usage(
                text=cleaned_text,
                duration_ms=duration_ms,
                voice=used_voice,
                style=used_style,
                rate=used_rate,
                volume=used_volume,
                length_bytes=None,
                file_path=None,
                metadata={"error": str(e)},
            )
        except Exception:
            pass
        return None
