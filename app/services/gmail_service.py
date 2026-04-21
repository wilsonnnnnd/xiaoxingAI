from fastapi import HTTPException

from app import db
from app.skills.gmail.client import fetch_emails
from app.skills.gmail.schemas import GmailFetchRequest, GmailProcessRequest
from app.workflows.email_processing_flow import run_email_processing_flow

class GmailService:
    def fetch(self, payload: GmailFetchRequest, *, user_id: int) -> dict:
        """从 Gmail 拉取邮件列表（不做 AI 处理）"""
        try:
            emails = fetch_emails(query=payload.query, max_results=payload.max_results, user_id=user_id)
            return {"count": len(emails), "emails": emails}
        except RuntimeError as e:
            raise HTTPException(status_code=401, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"拉取失败: {str(e)}")

    def process(self, payload: GmailProcessRequest, *, user_id: int) -> dict:
        """从 Gmail 拉取邮件并对每封执行完整 AI 处理流程"""
        try:
            emails = fetch_emails(query=payload.query, max_results=payload.max_results, user_id=user_id)
        except RuntimeError as e:
            raise HTTPException(status_code=401, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"拉取失败: {str(e)}")

        notify_bots = db.get_notify_bots(user_id) if payload.send_telegram else []
        results = []
        for email in emails:
            try:
                processed = run_email_processing_flow(
                    email,
                    user_id=user_id,
                    notify_bots=notify_bots,
                    send_telegram_enabled=bool(payload.send_telegram),
                    mark_read_enabled=bool(payload.mark_read),
                    persist_result=True,
                    bind_notify_refs=True,
                    max_ai_retries=1,
                )
                processed["id"] = email["id"]
                processed["from"] = email["from"]
                processed["date"] = email["date"]

                results.append({"status": "ok", **processed})
            except Exception as e:
                results.append({
                    "status": "error",
                    "id":      email["id"],
                    "subject": email["subject"],
                    "error":   str(e)
                })

        return {"count": len(results), "results": results}
