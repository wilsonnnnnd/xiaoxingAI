# Nginx 部署配置说明

本文档记录为 XiaoxingAI 项目配置 nginx 反向代理的全过程。

---

## 目标架构

```
浏览器 → http://98.80.72.38 (nginx :80)
                │
                ├── /api/*  →  FastAPI 后端 (127.0.0.1:8000)
                │
                └── /*      →  React 前端静态文件 (dist/)
```

**核心思路：** nginx 统一对外暴露 80 端口，前端静态文件由 nginx 直接伺服，所有 `/api/` 开头的请求被代理转发给 FastAPI，同时去掉 `/api` 前缀，使后端路由保持不变。

---

## 为什么需要 nginx？

原本用 `serve -s dist -l 3000` 启动前端，存在以下问题：

1. **缺少 API 代理**：`serve` 是一个纯静态文件服务器，无法将 `/api/*` 转发给 FastAPI 后端。前端调用 `/api/auth/me` 时，`serve` 会把自己的 `index.html` 返回（因为是 SPA 模式），导致 axios 拿到 HTML 字符串而非 JSON。
2. **React 崩溃**：`Layout.tsx` 把这个 HTML 字符串当作 user 对象使用，访问 `me.email[0]` 时 `email` 是 `undefined` → 抛 TypeError → 整页空白。
3. **需要记端口**：`http://98.80.72.38:3000` 不直观，nginx 走标准 80 端口更简洁。

---

## 操作步骤

### 1. 编写 nginx 站点配置

创建文件 `/etc/nginx/sites-available/xiaoxingai`：

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    # 前端静态文件根目录
    root /home/ubuntu/xiaoxingAI/frontend/dist;
    index index.html;

    # API 反向代理 → FastAPI 后端（自动去掉 /api 前缀）
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # WebSocket 支持（/api/ws/worker/status 等）
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }

    # SPA fallback：所有不存在的路径都返回 index.html，由 React Router 处理
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**关键点说明：**

| 配置项 | 说明 |
|--------|------|
| `proxy_pass http://127.0.0.1:8000/;` | 末尾的 `/` 很重要，会自动去掉 `/api` 前缀转发 |
| `proxy_set_header Upgrade / Connection` | 让 nginx 支持 WebSocket 升级（状态订阅用到） |
| `proxy_read_timeout 86400` | WebSocket 长连接不超时（默认 60s 会断） |
| `try_files $uri $uri/ /index.html` | SPA 必须的 fallback，否则刷新页面会 404 |

### 2. 启用配置，禁用默认站点

```bash
# 创建软链接启用新站点
sudo ln -sf /etc/nginx/sites-available/xiaoxingai /etc/nginx/sites-enabled/xiaoxingai

# 禁用 nginx 默认站点（否则两个 default_server 冲突）
sudo rm -f /etc/nginx/sites-enabled/default

# 测试配置语法
sudo nginx -t

# 重载 nginx（不中断现有连接）
sudo systemctl reload nginx
```

### 3. 修复目录权限

nginx 以 `www-data` 用户运行，默认无法访问 `/home/ubuntu/` 下的文件，会报 `Permission denied (13)`。

需要给路径上的每一级目录加上"其他用户可执行（进入目录）"权限，再给 dist 内的文件加可读权限：

```bash
chmod o+x /home/ubuntu
chmod o+x /home/ubuntu/xiaoxingAI
chmod o+x /home/ubuntu/xiaoxingAI/frontend
chmod o+x /home/ubuntu/xiaoxingAI/frontend/dist
chmod -R o+r /home/ubuntu/xiaoxingAI/frontend/dist
```

> **为什么是 `o+x` 而不是 `o+r`？**  
> 对目录来说，`x`（执行）权限表示"允许进入/遍历该目录"，`r` 表示"允许列出目录内容"。nginx 只需要进入目录，所以只要 `x` 即可，不需要暴露目录列表。

---

## 验证

```bash
# 前端应返回 200
curl -o /dev/null -w "%{http_code}" http://127.0.0.1/home

# API 应返回 200 + JSON
curl http://127.0.0.1/api/health
```

预期输出：
```
200
{"status":"ok"}
```

---

## 日常维护命令

```bash
# 查看 nginx 状态
sudo systemctl status nginx

# 重载配置（修改配置后执行，不中断服务）
sudo systemctl reload nginx

# 重启 nginx
sudo systemctl restart nginx

# 查看错误日志（排查 502/403/500 等问题）
sudo tail -f /var/log/nginx/error.log

# 查看访问日志
sudo tail -f /var/log/nginx/access.log

# 测试配置语法是否正确
sudo nginx -t
```

---

## 前端重新构建后无需重启 nginx

每次修改前端代码后，只需重新构建：

```bash
cd /home/ubuntu/xiaoxingAI/frontend
npm run build
```

nginx 直接读取 `dist/` 目录里的文件，构建完成即生效，无需重载 nginx。

---

## 文件位置一览

| 文件 | 路径 |
|------|------|
| nginx 站点配置 | `/etc/nginx/sites-available/xiaoxingai` |
| 启用的软链接 | `/etc/nginx/sites-enabled/xiaoxingai` |
| nginx 主配置 | `/etc/nginx/nginx.conf` |
| 前端 dist 目录 | `/home/ubuntu/xiaoxingAI/frontend/dist` |
| nginx 错误日志 | `/var/log/nginx/error.log` |
