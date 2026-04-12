from fastapi import HTTPException
from app import db
from app.core import bot_worker as tg_bot_worker

class TelegramService:
    def clear_history(self, user: dict) -> dict:
        """清空对话历史记录（内存 + Redis + 日志DB）"""
        tg_bot_worker.clear_history()
        uid = None if user.get("role") == "admin" else user["id"]
        deleted = db.clear_logs("chat", user_id=uid)
        return {"ok": True, "deleted": deleted}

    def get_profile(self) -> dict:
        """获取当前默认 Bot 的用户画像（多账号迁移中：暂用 bot_id=1 查找）"""
        bots = db.get_all_bots()
        if not bots:
            return {"chat_id": None, "profile": "", "updated_at": None}
        first_bot = bots[0]
        bot_id = first_bot["id"]
        profile    = db.get_profile(bot_id)
        updated_at = db.get_profile_updated_at(bot_id)
        return {"chat_id": first_bot["chat_id"], "profile": profile, "updated_at": updated_at}

    def delete_profile(self) -> dict:
        """删除当前默认 Bot 的用户画像"""
        bots = db.get_all_bots()
        if not bots:
            raise HTTPException(status_code=404, detail="暂无已注册的 Bot")
        db.delete_profile(bots[0]["id"])
        return {"ok": True}

    def generate_profile(self) -> dict:
        """手动触发用户画像生成（基于今日聊天记录），生成后清空今日记录，供调试使用"""
        bots = db.get_all_bots()
        if not bots:
            raise HTTPException(status_code=400, detail="暂无已注册的 Bot")
        bot_id = bots[0]["id"]
        try:
            profile, tokens = tg_bot_worker.generate_profile_now(bot_id)
            return {"ok": True, "bot_id": bot_id, "profile": profile, "tokens": tokens}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"画像生成失败: {str(e)}")
