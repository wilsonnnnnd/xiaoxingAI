from fastapi import HTTPException
from app import db
from app.skills.gmail.schemas import GmailFetchRequest, GmailProcessRequest
from app.skills.gmail.pipeline import process_email
from app.core.telegram import send_message
from app.skills.gmail.client import fetch_emails, mark_as_read

class GmailService:
    def fetch(self, payload: GmailFetchRequest) -> dict:
        """从 Gmail 拉取邮件列表（不做 AI 处理）"""
        try:
            emails = fetch_emails(query=payload.query, max_results=payload.max_results)
            return {"count": len(emails), "emails": emails}
        except RuntimeError as e:
            raise HTTPException(status_code=401, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"拉取失败: {str(e)}")

    def process(self, payload: GmailProcessRequest) -> dict:
        """从 Gmail 拉取邮件并对每封执行完整 AI 处理流程"""
        try:
            emails = fetch_emails(query=payload.query, max_results=payload.max_results)
        except RuntimeError as e:
            raise HTTPException(status_code=401, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"拉取失败: {str(e)}")

        results = []
        for email in emails:
            try:
                processed = process_email(
                    email["subject"],
                    email["body"] or email["snippet"],
                    sender=email.get("from", ""),
                    date=email.get("date", ""),
                    email_id=email.get("id", ""),
                )
                processed["id"]   = email["id"]
                processed["from"] = email["from"]
                processed["date"] = email["date"]

                sent = False
                if payload.send_telegram:
                    send_message(processed["telegram_message"], parse_mode="HTML")
                    processed["telegram_sent"] = True
                    sent = True

                if payload.mark_read and email["id"]:
                    mark_as_read(email["id"])

                if email.get("id"):
                    db.save_email_record(
                        email_id=email["id"],
                        subject=email["subject"],
                        sender=email.get("from", ""),
                        date=email.get("date", ""),
                        body=email.get("body") or email.get("snippet", ""),
                        analysis=processed.get("analysis", {}),
                        summary=processed.get("summary", {}),
                        telegram_msg=processed.get("telegram_message", ""),
                        tokens=processed.get("tokens", 0),
                        priority=processed.get("analysis", {}).get("priority", ""),
                        sent_telegram=sent,
                    )

                results.append({"status": "ok", **processed})
            except Exception as e:
                results.append({
                    "status": "error",
                    "id":      email["id"],
                    "subject": email["subject"],
                    "error":   str(e)
                })

        return {"count": len(results), "results": results}
