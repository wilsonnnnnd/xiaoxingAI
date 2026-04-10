# Help — Xiaoxing AI

[中文文档](help.zh.md)

---

## How to Get Tokens

### Telegram Bot Token

1. Search **@BotFather** on Telegram
2. Send /newbot
3. Enter a display name and username ending in bot
4. BotFather replies with the token

```
Example: 1234567890:ABCdefGhIJKlmNoPQRstuVWXyz
```

### Telegram Chat ID

**Method 1 (easiest):** Search **@userinfobot** on Telegram and send any message — it replies with your Chat ID.

**Method 2:** Send any message to your Bot, then open:
```
https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
```
Find `message.chat.id` in the returned JSON. The Settings page also has a **Get Chat ID** button.

### Google OAuth2 credentials.json

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable **Gmail API**: APIs & Services → Library → search Gmail API → Enable
4. Create credentials: APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: **Desktop app**
5. Download the JSON file, rename it to `credentials.json`, place in project root

> `credentials.json` contains sensitive OAuth client secrets and is excluded from git via `.gitignore`. Never commit it.
