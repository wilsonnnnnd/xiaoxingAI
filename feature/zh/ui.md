# Web 界面

## 概述

Xiaoxing 提供浅色极简单页应用（React + TypeScript + Vite + Tailwind CSS）。生产模式下前端静态文件由 FastAPI 后端直接托管。

## 页面结构

| 路由 | 页面 | 说明 |
|------|------|------|
| `/login` | 登录 | 邮箱 + 密码认证 |
| `/home` | 首页 / 仪表盘 | 系统概览，快速启动检查清单 |
| `/skill` | 技能中心 | 技能入口页（当前为 Gmail） |
| `/skill/gmail` | Gmail | Worker 控制、实时邮件日志、用户配置 |
| `/prompts` | Prompt 编辑器 | 查看和编辑 Prompt 文件（管理员 + 普通用户受限视图） |
| `/settings` | 设置 | Google OAuth 授权、Bot 配置、环境变量 |
| `/settings/reply-format` | 回复格式 | 配置每用户回复模板与署名 |
| `/users` | 用户管理 | 仅管理员：创建和管理用户 |
| `/debug` | 调试工具 | 仅管理员：调试工具 |
| `/help` | 帮助 | 新手快速开始与常见操作说明 |

## 国际化（i18n）

- 支持中文和英文
- Sidebar 提供语言切换按钮
- 语言偏好本地持久化，用户手动切换时会保存到服务器
- 翻译键位于 `frontend/src/i18n/en.ts` 和 `zh.ts`

## 移动端适配

- `md` 及以上：固定 Sidebar 布局
- `md` 以下：顶部栏 + 抽屉 Sidebar（遮罩覆盖；点击导航自动关闭）

参考实现：

- `frontend/src/components/Layout.tsx`
- `frontend/src/components/layout/Sidebar.tsx`

## UI 文档

- UI 设计规范（浅色极简）：[doc/ui-design.md](../../doc/ui-design.md)
- 前端工程指南： [doc/ui-guide.md](../../doc/ui-guide.md)

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
