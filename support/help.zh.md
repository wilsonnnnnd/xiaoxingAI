# 帮助 — 小星 AI

[English](help.md)

---

## Token 获取方式

### Telegram Bot Token

1. 在 Telegram 搜索 **@BotFather**
2. 发送 /newbot
3. 按提示输入 Bot 名称和用户名（必须以 bot 结尾）
4. BotFather 返回的 HTTP API Token 即为所需 Token

```
示例：1234567890:ABCdefGhIJKlmNoPQRstuVWXyz
```

### Telegram Chat ID

**方法一（最简单）：** 在 Telegram 搜索 **@userinfobot**，发送任意消息，它会直接回复你的 Chat ID。

**方法二：** 向你的 Bot 发送一条消息，然后访问：
```
https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
```
在返回 JSON 中找到 `message.chat.id` 字段。设置页的 **Get Chat ID** 按钮也可自动获取。

### Google OAuth2 凭据（credentials.json）

1. 打开 [Google Cloud Console](https://console.cloud.google.com/)
2. 新建或选择一个项目
3. 启用 **Gmail API**：API 和服务 → 库 → 搜索 Gmail API → 启用
4. 创建凭据：API 和服务 → 凭据 → 创建凭据 → OAuth 客户端 ID
   - 应用类型选 **桌面应用（Desktop app）**
5. 下载 JSON 文件，重命名为 `credentials.json`，放到项目根目录

> `credentials.json` 包含敏感的 OAuth 客户端密钥，已加入 `.gitignore`，请勿提交到版本库。
