# 🚀 XiaoxingAI Deployment Guide

This document shows how to deploy XiaoxingAI on a cloud server such as Alibaba Cloud ECS.

Recommended stack:

- Frontend: React + Vite, served by Nginx
- Backend: FastAPI + Uvicorn, managed by systemd
- Database: PostgreSQL
- Cache: Redis
- HTTPS: Nginx + Certbot

---

## 1. Before You Start

### 1.1 Requirements

Recommended versions:

- Python 3.11+
- Node.js 18+
- PostgreSQL 16+
- Redis 7+
- Nginx

> Do not use old Python versions like 3.6 or 3.7. Some packages may fail to install.

### 1.2 Required Files

Please prepare these files before deployment:

- Project source code
- `.env`
- `credentials.json` for Google OAuth

If `.env` does not exist yet, run:

```bash
cp .env.example .env
```

---

## 2. Recommended Project Path

To avoid Nginx permission problems, do not put the project inside `/root`.

Recommended path:

```bash
/opt/xiaoxing
```

---

## 3. Server Setup

These commands are for CentOS, Rocky Linux, or AlmaLinux:

```bash
sudo apt update -y
sudo apt install -y git nginx redis gcc curl
```

If Node.js 18+ and Python 3.11+ are not installed, install them first.

You can also create a dedicated user:

```bash
sudo useradd -r -m -s /bin/bash xiaoxing || true
sudo mkdir -p /opt/xiaoxing
sudo chown -R xiaoxing:xiaoxing /opt/xiaoxing
```

---

## 4. Clone the Project and Install Dependencies

```bash
cd /opt
sudo git clone https://github.com/wilsonnnnnd/xiaoxingAI.git xiaoxing
sudo chown -R xiaoxing:xiaoxing /opt/xiaoxing
cd /opt/xiaoxing

python3.11 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

Install frontend packages:

```bash
cd /opt/xiaoxing/frontend
npm install
npm run build
```

---

## 5. Configure Environment Variables

Create and edit the `.env` file:

```bash
cd /opt/xiaoxing
cp .env.example .env
vi .env
```

At least set these values:

```env
ADMIN_USER=admin@example.com
ADMIN_PASSWORD=<change-me>
JWT_SECRET=<please-change-this-secret>
POSTGRES_DSN=postgresql://xiaoxing_user:your_password@127.0.0.1:5432/xiaoxing
REDIS_URL=redis://127.0.0.1:6379
FRONTEND_URL=https://your-domain.com
```

If you use OpenAI, also add:

```env
LLM_BACKEND=openai
LLM_API_KEY=<your_openai_key>
OPENAI_API_KEY=<legacy_alias_optional>
```

If you use a local model, make sure the model service is running and the URL in `.env` is correct.

---

## 6. Configure PostgreSQL

### 6.1 Create the Database and User

```bash
sudo -u postgres psql
```

Run these SQL commands:

```sql
CREATE DATABASE xiaoxing;
CREATE USER xiaoxing_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE xiaoxing TO xiaoxing_user;
```

### 6.2 Change the Authentication Method

If you see errors like:

- `Ident authentication failed`
- `Peer authentication failed`

check the `pg_hba.conf` file and change local auth to `md5`:

```conf
local   all             all                                     md5
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
```

Then restart PostgreSQL:

```bash
sudo systemctl restart postgresql
```

> If your database host is set to `db`, change it to `127.0.0.1` or `localhost` for a normal server deployment.

---

## 7. Configure Redis

```bash
sudo systemctl enable redis
sudo systemctl start redis
sudo systemctl status redis
```

If your system uses another service name, try:

```bash
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

---

## 8. First Backend Test

Start the backend once to make sure it works:

```bash
cd /opt/xiaoxing
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Health check:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/api/health
```

Expected result:

```json
{"status":"ok"}
```

> On the first start, the app will create the database tables and the admin account from the `.env` file.

---

## 9. Configure systemd

Create the service file:

```bash
sudo vi /etc/systemd/system/xiaoxing.service
```

Add this content:

```ini
[Unit]
Description=Xiaoxing AI Backend
After=network.target postgresql.service redis.service

[Service]
User=xiaoxing
Group=xiaoxing
WorkingDirectory=/opt/xiaoxing
EnvironmentFile=/opt/xiaoxing/.env
ExecStart=/opt/xiaoxing/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then run:

```bash
sudo systemctl daemon-reload
sudo systemctl enable xiaoxing
sudo systemctl start xiaoxing
sudo systemctl status xiaoxing
```

Now Xiaoxing is managed by systemctl and can start automatically when the server boots.

Useful commands:

```bash
sudo systemctl start xiaoxing
sudo systemctl stop xiaoxing
sudo systemctl restart xiaoxing
sudo systemctl status xiaoxing
sudo systemctl enable xiaoxing
sudo systemctl disable xiaoxing
```

To view logs:

```bash
journalctl -u xiaoxing -f
```

---

## 10. Configure Nginx

Create the site config file:

```bash
sudo vi /etc/nginx/conf.d/xiaoxing.conf
```

Example config:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    root /opt/xiaoxing/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /health {
        proxy_pass http://127.0.0.1:8000/health;
    }
}
```

Test and restart Nginx:

```bash
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
```

If there is a default site conflict, remove it:

```bash
sudo rm -f /etc/nginx/conf.d/default.conf
sudo systemctl restart nginx
```

---

## 11. Configure HTTPS

Before running Certbot, make sure these ports are open in your cloud security group and firewall:

- Port 80
- Port 443

If port 443 is closed, this command may fail or HTTPS may not work correctly:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

After the certificate is created, test these addresses:

- `http://your-domain.com`
- `https://your-domain.com`

---

## 12. Final Check List

Please check these items one by one:

1. Your domain points to the public IP of the server.
2. Ports `80` and `443` are open in the security group or firewall.
3. The `xiaoxing` service is running normally.
4. `nginx -t` passes.
5. The health endpoint returns a normal result.
6. The frontend page opens correctly.
7. The admin account can log in.

---

## 13. Common Problems and Fixes

### 13.1 Python Version Is Too Old

**Problem:** package install fails, for example PyJWT error.  
**Fix:** upgrade to Python 3.10+; Python 3.11 is recommended.

### 13.2 PostgreSQL Connection Fails

**Problem:** `Ident authentication failed` or `Peer authentication failed`.  
**Fix:** change `pg_hba.conf` to use `md5`.

### 13.3 Wrong Database Host

**Problem:** `could not translate host name "db"`.  
**Cause:** old Docker-style config.  
**Fix:** change the database host to `127.0.0.1`.

### 13.4 Redis Cannot Start

**Problem:** `redis.service not found`.  
**Fix:** try the service name `redis-server`.

### 13.5 File Upload with scp Fails

**Problem:** the path does not exist.  
**Cause:** the command was run on the server instead of your local machine.  
**Fix:** run `scp` on your local terminal.

### 13.6 Nginx Returns 500 or Permission Denied

**Problem:** you see a 500 page and `Permission denied` in the log.  
**Fix:** do not deploy the project under `/root`; use `/opt/xiaoxing` instead.

### 13.7 Rewrite Loop Error

**Problem:** `rewrite or internal redirection cycle`.  
**Fix:** make sure the Nginx `root` path is correct and `frontend/dist/index.html` is readable.

### 13.8 Website Cannot Be Reached

**Problem:** browser timeout or `ERR_CONNECTION_TIMED_OUT`.  
**Fix:** check domain DNS, firewall rules, and security group settings.

### 13.9 HTTPS Setup Fails

**Problem:** Certbot cannot complete, or HTTPS is still unreachable.  
**Fix:** make sure port `443` is open before running Certbot.

### 13.10 Nginx Server Name Conflict

**Problem:** `conflicting server name`.  
**Fix:** remove the default config or any duplicate server block.

---

## 14. Recommended Access URLs

- Frontend: `https://your-domain.com`
- Health check: `https://your-domain.com/health`
- API base path: `https://your-domain.com/api/`
