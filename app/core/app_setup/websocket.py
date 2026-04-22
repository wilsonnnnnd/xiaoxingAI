from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from app.domains import worker


def register_websocket(app: FastAPI) -> None:
    @app.websocket("/api/ws/worker/status")
    async def ws_worker_status(websocket: WebSocket):
        from app import db
        from app.core import auth as auth_mod
        from app.domains.gmail import telegram_updates as tg_updates

        token = websocket.query_params.get("token", "").strip()
        if not token:
            await websocket.close(code=4401)
            return
        try:
            payload = auth_mod.decode_token(token)
            user = db.get_user_by_id(int(payload["sub"]))
        except Exception:
            await websocket.close(code=4401)
            return
        if not user:
            await websocket.close(code=4401)
            return

        await websocket.accept()
        from app.core.realtime import ws as ws_pub

        q = ws_pub.subscribe_worker()
        try:
            if user.get("role") == "admin":
                await websocket.send_json(
                    {
                        "scope": "global",
                        "system": worker.get_status(),
                        "user": worker.get_user_status(user_id=int(user["id"])),
                    }
                )
            else:
                await websocket.send_json(
                    {
                        "scope": "user",
                        "user": worker.get_user_status(user_id=int(user["id"])),
                        "system": {"telegram_updates": tg_updates.status()},
                    }
                )
            while True:
                await q.get()
                if user.get("role") == "admin":
                    await websocket.send_json(
                        {
                            "scope": "global",
                            "system": worker.get_status(),
                            "user": worker.get_user_status(user_id=int(user["id"])),
                        }
                    )
                else:
                    await websocket.send_json(
                        {
                            "scope": "user",
                            "user": worker.get_user_status(user_id=int(user["id"])),
                            "system": {"telegram_updates": tg_updates.status()},
                        }
                    )
        except WebSocketDisconnect:
            pass
        except Exception:
            pass
        finally:
            ws_pub.unsubscribe_worker(q)
