# GitHub Actions 自动部署配置说明

每次 push 到 `main` 分支后，自动通过 SSH 连接服务器完成拉代码、装依赖、构建前端、重启后端全流程。

---

## 整体思路

```
本地 git push → GitHub Actions 触发 → SSH 连接服务器 → 执行部署脚本
```

GitHub Actions 本身运行在 GitHub 的云服务器上，它通过 SSH 私钥登录你的云服务器，执行一段 shell 脚本完成部署。因此需要提前做三件事：

1. **服务器上**：把 FastAPI 后端交给 systemd 管理（不再手动跑 uvicorn）
2. **服务器上**：允许 `ubuntu` 用户无密码 `sudo systemctl restart` 后端服务（CI 无法输入密码）
3. **GitHub 上**：在仓库 Secrets 里存入 SSH 连接信息

---

## 第一步：创建 systemd 服务（服务器上操作）

**为什么需要这步？**  
原来是手动在终端跑 `uvicorn`，终端关掉服务就停了，也无法用脚本可靠重启。用 systemd 管理后，服务可以被脚本重启，服务器重启也会自动拉起。

### 创建服务文件

```bash
sudo nano /etc/systemd/system/xiaoxingai.service
```

写入以下内容：

```ini
[Unit]
Description=XiaoxingAI FastAPI Backend
After=network.target postgresql.service redis.service

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu/xiaoxingAI
EnvironmentFile=/home/ubuntu/xiaoxingAI/.env
ExecStart=/home/ubuntu/xiaoxingAI/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**关键字段说明：**

| 字段 | 说明 |
|------|------|
| `EnvironmentFile` | 自动加载 `.env` 里的环境变量，不用在命令行里手动 export |
| `Restart=always` | 进程崩溃后 5 秒自动重启 |
| `After=postgresql.service redis.service` | 确保数据库和 Redis 先启动再启动后端 |
| `User=ubuntu` | 以普通用户身份运行，不用 root |

### 启用并启动服务

```bash
# 让 systemd 读取新服务文件
sudo systemctl daemon-reload

# 设置开机自启
sudo systemctl enable xiaoxingai

# 把原来手动跑的 uvicorn 停掉，改由 systemd 启动
kill $(pgrep -f 'uvicorn app.main')
sudo systemctl start xiaoxingai

# 验证是否正常运行
sudo systemctl status xiaoxingai
```

---

## 第二步：允许无密码 sudo 重启服务

**为什么需要这步？**  
GitHub Actions 通过 SSH 执行脚本时没有交互式终端，无法输入 sudo 密码。需要提前授权 `ubuntu` 用户对特定命令免密 sudo。

```bash
echo 'ubuntu ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart xiaoxingai, /usr/bin/systemctl reload nginx, /usr/bin/systemctl start xiaoxingai' \
  | sudo tee /etc/sudoers.d/xiaoxingai-deploy > /dev/null

sudo chmod 440 /etc/sudoers.d/xiaoxingai-deploy

# 验证语法正确
sudo visudo -c
```

> **安全说明：** 只授权了 `restart xiaoxingai` 和 `reload nginx` 这两个具体命令，而不是 `ALL`，最小权限原则。

---

## 第三步：在 GitHub 仓库添加 Secrets

GitHub Actions 脚本里不能明文写服务器 IP 和私钥，需要存在仓库的加密 Secrets 里。

进入仓库 → **Settings → Secrets and variables → Actions → New repository secret**

需要添加以下 4 个：

| Secret 名称 | 值 | 说明 |
|---|---|---|
| `HOST` | `98.80.72.38` | 服务器公网 IP |
| `USERNAME` | `ubuntu` | SSH 登录用户名 |
| `PORT` | `22` | SSH 端口（默认 22） |
| `SSH_PRIVATE_KEY` | 私钥全文 | 见下方说明 |

### 获取 SSH 私钥

在**本地机器**上执行（就是你平时 SSH 连服务器所用的那个私钥）：

```bash
cat ~/.ssh/id_rsa
# 或者
cat ~/.ssh/id_ed25519
```

把输出的全部内容（包括 `-----BEGIN OPENSSH PRIVATE KEY-----` 和 `-----END OPENSSH PRIVATE KEY-----`）完整粘贴到 `SSH_PRIVATE_KEY` secret 里。

### 确认公钥已在服务器上

对应的公钥需要在服务器的 `~/.ssh/authorized_keys` 里：

```bash
# 在服务器上执行，检查公钥是否存在
cat ~/.ssh/authorized_keys
```

如果没有，把公钥追加进去：

```bash
# 把 id_rsa.pub 或 id_ed25519.pub 的内容追加到这里
echo "ssh-rsa AAAA..." >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

---

## 第四步：创建 Workflow 文件

文件路径：`.github/workflows/deploy.yml`

```yaml
name: Deploy to Server

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          port: ${{ secrets.PORT }}
          script: |
            set -e
            cd ~/xiaoxingAI

            echo "📥 Pull latest code"
            git pull origin main

            echo "🐍 Install Python dependencies"
            .venv/bin/pip install -r requirements.txt --quiet

            echo "🏗 Build frontend"
            cd frontend
            npm ci --silent
            npm run build
            cd ..

            echo "🔄 Restart backend"
            sudo systemctl restart xiaoxingai

            echo "✅ Deploy complete"
            sudo systemctl status xiaoxingai --no-pager | tail -5
```

**脚本各步骤说明：**

| 步骤 | 命令 | 说明 |
|------|------|------|
| 拉代码 | `git pull origin main` | 拉取最新提交 |
| 装 Python 依赖 | `.venv/bin/pip install -r requirements.txt` | 直接用项目 venv 里的 pip，不需要激活 venv |
| 安装前端依赖 | `npm ci` | 比 `npm install` 更严格，严格按 `package-lock.json` 安装，适合 CI |
| 构建前端 | `npm run build` | 生成 `dist/`，nginx 直接读取，无需重启 |
| 重启后端 | `sudo systemctl restart xiaoxingai` | 重启 FastAPI，加载新代码 |

> `set -e`：任意一步失败立即退出，防止半成功的部署状态。

---

## 验证部署是否生效

push 到 main 后，在 GitHub 仓库的 **Actions** 标签页可以看到运行状态和每步日志。

在服务器上手动验证：

```bash
# 查看后端服务状态
sudo systemctl status xiaoxingai

# 查看后端日志
sudo journalctl -u xiaoxingai -n 50 --no-pager

# 验证 API 可访问
curl http://127.0.0.1/api/health
```

---

## 常见问题

**Q: Actions 报 `Permission denied (publickey)`**  
A: SSH 私钥和公钥不匹配，或公钥没有加到服务器 `~/.ssh/authorized_keys`。

**Q: `sudo systemctl restart` 卡住要密码**  
A: 第二步的 sudoers 配置没有生效，重新执行 `sudo visudo -c` 检查语法。

**Q: 前端改了但没更新**  
A: `npm run build` 失败了，在 Actions 日志里查看具体报错。

**Q: 后端重启后端口没起来**  
A: `sudo journalctl -u xiaoxingai -n 30` 查看启动日志，通常是 `.env` 缺少配置或依赖没装完整。
