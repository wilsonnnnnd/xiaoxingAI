# Web 界面

## 概述

Xiaoxing 提供深色主题单页应用（React + TypeScript + Vite + Tailwind CSS）。生产模式下前端静态文件由 FastAPI 后端直接托管。

## 页面结构

| 路由 | 页面 | 说明 |
|------|------|------|
| `/login` | 登录 | 邮箱 + 密码认证 |
| `/home` | 首页 / 仪表盘 | 系统概览，快速启动检查清单 |
| `/skill` | 技能中心 | Gmail 和 Chat 技能的入口页 |
| `/skill/gmail` | Gmail | Worker 控制、实时邮件日志、用户配置 |
| `/skill/chat` | 聊天 | Bot Worker 控制、人格生成器、Prompt 管理、实时聊天日志 |
| `/prompts` | Prompt 编辑器 | 查看和编辑所有系统 Prompt |
| `/settings` | 设置 | Google OAuth 授权、Bot 配置、环境变量 |
| `/settings/reply-format` | 回复格式 | 配置每用户回复模板与署名 |
| `/users` | 用户管理 | 仅管理员：创建和管理用户 |
| `/persona-config` | 人设配置 | 仅管理员：为星座/属相/性别配置人格风格提示词，供人格生成器参考 |
| `/debug` | 调试工具 | 手动触发画像更新、缓存清理等 |

## 国际化（i18n）

- 支持中文和英文
- 顶部导航栏提供语言切换按钮
- 偏好通过 **Zustand** 持久化（刷新后保留）
- 翻译键位于 `frontend/src/i18n/en.ts` 和 `zh.ts`

## 开发模式

```bash
cd frontend
npm run dev
```
Vite 开发服务器在 `http://localhost:5173` 启动，支持热重载。API 调用代理到 `http://127.0.0.1:8000`。

## 生产模式

```bash
cd frontend
npm run build
```
构建产物输出到 `frontend/dist/`，由 FastAPI 在 `http://127.0.0.1:8000` 托管。

## 技术栈

| 层级 | 库/框架 |
|------|--------|
| UI 框架 | React 19 |
| 开发语言 | TypeScript |
| 构建工具 | Vite |
| 样式 | Tailwind CSS |
| 数据请求 | TanStack Query v5 |
| 状态管理 | Zustand |
| HTTP 客户端 | Axios |

## 相关文档

- [身份认证 →](auth.md)
