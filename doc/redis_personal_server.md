# Redis：个人服务器部署指南（适用于 xiaoxing 项目）

## 概要与适用场景
本指南面向希望在个人服务器上为本项目部署 Redis 的开发者/运维人员。假设服务器运行 Ubuntu/Debian 或可运行 Docker，并有 sudo 权限与 SSH 访问。内容涵盖三种常见部署方式：系统包（systemd）、Docker（容器化）、Docker Compose；并包含安全、备份与监控建议，以及与本项目的连接示例（`REDIS_URL`）。

---

## 先决条件
- 有一台可访问的服务器（公网或内网），可以通过 SSH 登录并获得 sudo 权限。  
- 已安装 `docker`（如果选择容器化）或可安装系统包。  
- 已为应用准备 `.env`（项目根目录），可以配置 `REDIS_URL`。

---

## 1. 与本项目的连接（示例）
- 本项目读取环境变量 `REDIS_URL`（见 `app/config.py`）。常见格式：
  - 无密码（不建议生产）：

    `REDIS_URL=redis://localhost:6379/0`

  - 带密码（推荐）

    `REDIS_URL=redis://:YourStrongPassword@your.server.ip:6379/0`

  - 使用 TLS（服务端启用 TLS 时）：

    `REDIS_URL=rediss://:YourStrongPassword@your.server.ip:6379/0`

请在部署完成并能用 `redis-cli` 验证后，将 `REDIS_URL` 写入项目的 `.env` 并重启应用。

---

## 2. 方案 A：系统包（Ubuntu / Debian，systemd 管理）
适合不使用容器的场景。

1) 安装与启动

```bash
sudo apt update
sudo apt install redis-server -y
sudo systemctl enable --now redis-server
sudo systemctl status redis-server
```

2) 关键配置（编辑 `/etc/redis/redis.conf`）
- 建议至少修改：
  - `bind 127.0.0.1`（仅本机访问）或指定私有网卡 IP；若必须远程访问，谨慎使用 `0.0.0.0` 并配合防火墙。  
  - `requirepass YourVeryStrongPassword`（启用密码认证）。  
  - `appendonly yes`（启用 AOF，减少数据丢失）。  
  - `maxmemory` 与 `maxmemory-policy`（例如 `maxmemory 1gb`、`allkeys-lru`）。

示例最小片段：

```
bind 127.0.0.1
protected-mode yes
requirepass YourVeryStrongPassword
appendonly yes
maxmemory 1gb
maxmemory-policy allkeys-lru
```

3) 重启与验证

```bash
sudo systemctl restart redis-server
redis-cli -h 127.0.0.1 -p 6379 -a 'YourVeryStrongPassword' PING
# 返回 PONG
```

4) 防火墙（若需远程访问）

```bash
# 仅允许应用服务器 IP 访问（替换 APP_SERVER_IP）
sudo ufw allow from APP_SERVER_IP to any port 6379 proto tcp
sudo ufw reload
sudo ufw status
```

若应用与 Redis 在同一台机器，推荐仅 `bind 127.0.0.1` 并不开放远程端口。

---

## 3. 方案 B：使用 Docker 运行（推荐用于隔离）

1) 在服务器上准备目录

```bash
sudo mkdir -p /opt/redis/{data,conf}
sudo chown -R $(whoami):$(whoami) /opt/redis
```

2) 在 `/opt/redis/conf/redis.conf` 中写入配置（示例）：

```
bind 0.0.0.0
protected-mode yes
requirepass YourVeryStrongPassword
appendonly yes
maxmemory 1gb
maxmemory-policy allkeys-lru
```

（注意：如果只在本机使用，可把 `bind` 改为 `127.0.0.1`，并不映射端口）

3) 启动容器

```bash
docker run -d --name xiaoxing-redis \
  -v /opt/redis/data:/data \
  -v /opt/redis/conf/redis.conf:/usr/local/etc/redis/redis.conf:ro \
  -p 6379:6379 \
  --restart unless-stopped \
  redis:7 redis-server /usr/local/etc/redis/redis.conf
```

4) 验证

```bash
docker exec -it xiaoxing-redis redis-cli -a 'YourVeryStrongPassword' PING
```

5) Docker Compose（可选，示例 `docker-compose.yml`）

```yaml
version: '3.8'
services:
  redis:
    image: redis:7
    command: ["redis-server", "/usr/local/etc/redis/redis.conf"]
    volumes:
      - ./redis/redis.conf:/usr/local/etc/redis/redis.conf:ro
      - redis-data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped

volumes:
  redis-data:
```

---

## 4. TLS（可选，进阶）
若需在不受信网络中传输数据或提高安全性，可启用 Redis 的 TLS 支持（Redis 6+）。简要流程：

1) 用 OpenSSL 生成 CA、服务端证书与客户端证书（示例）：

```bash
# 生成 CA
openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 -out ca.crt -subj "/CN=MyRedisCA"

# 生成 server key & csr
openssl genrsa -out redis.key 4096
openssl req -new -key redis.key -out redis.csr -subj "/CN=$(hostname)"

# 用 CA 签发 server cert
openssl x509 -req -in redis.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out redis.crt -days 3650 -sha256
```

2) 在 `redis.conf` 中启用 TLS：

```
port 0
tls-port 6379
tls-cert-file /etc/redis/redis.crt
tls-key-file /etc/redis/redis.key
tls-ca-cert-file /etc/redis/ca.crt
tls-auth-clients no
```

3) 测试（使用 `redis-cli` 支持 TLS 的版本）：

```bash
redis-cli --tls --cacert /etc/redis/ca.crt -h your.server.ip -p 6379 -a 'YourVeryStrongPassword' PING
```

说明：生成并管理证书有复杂环节，生产环境可使用受信 CA 或云提供的 TLS 方案。

---

## 5. 备份策略（简要）
- 快照（RDB）：Redis 会根据 `save` 配置自动做 RDB 快照，可通过 `BGSAVE` 强制触发。RDB 文件通常位于 `/var/lib/redis/dump.rdb` 或容器的 `/data/dump.rdb`。  
- AOF：`appendonly yes` 会写 AOF 文件，窗口更小但文件更大。  
- 推荐：定期将 RDB/AOF 复制到外部存储（如 S3）。示例脚本（系统安装）

```bash
#!/bin/bash
BACKUP_DIR=/opt/redis/backups
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%F-%H%M%S)
redis-cli -a 'YourVeryStrongPassword' BGSAVE
cp /var/lib/redis/dump.rdb "$BACKUP_DIR/dump-$TIMESTAMP.rdb"
find "$BACKUP_DIR" -type f -mtime +30 -delete
```

把脚本放到 `/usr/local/bin/redis_backup.sh` 并加入 crontab：

```bash
# 每天凌晨 03:00 运行
0 3 * * * /usr/local/bin/redis_backup.sh
```

在 Docker 中可通过 `docker exec` 调用 `redis-cli BGSAVE`，并从挂载卷复制备份。

---

## 6. 监控与告警（简要）
- 使用 `oliver006/redis_exporter` 将 Redis 指标暴露给 Prometheus，然后用 Grafana 建仪表盘。  
- 重要指标：`used_memory`, `mem_fragmentation_ratio`, `evicted_keys`, `instantaneous_ops_per_sec`, `keyspace_hits/misses`, `aof_rewrites`, `rdb_bgsave_in_progress`。  
- 容器示例：

```bash
docker run -d --name redis-exporter -p 9121:9121 \
  -e REDIS_ADDR=redis://:YourVeryStrongPassword@127.0.0.1:6379 \
  oliver006/redis_exporter
```

Prometheus 配置示例：

```yaml
- job_name: 'redis'
  static_configs:
    - targets: ['redis-exporter:9121']
```

---

## 7. 与本项目整合步骤（快速清单）
1. 部署 Redis（systemd 或 Docker）。
2. 配置 `requirepass`（强密码）或 TLS。  
3. 配置防火墙，仅允许应用服务器访问 Redis 端口或使用私有网络。  
4. 测试连接：`redis-cli` 或 `docker exec ... redis-cli`（确认 `PING → PONG`）。  
5. 在项目 `.env` 中设置 `REDIS_URL`，例如：

```
REDIS_URL=redis://:YourVeryStrongPassword@your.server.ip:6379/0
```

6. 重启/部署应用并确认日志无 Redis 连接错误。

---

## 8. 常见问题排查（简短）
- `PONG` 未返回：检查服务是否运行、端口是否被防火墙阻止、`bind` 配置是否只允许本地连接。  
- 认证失败：确保 `requirepass` 与客户端使用的密码一致（URI 中 `:password@`）。  
- Protected mode 错误：若 `protected-mode yes` 且 `bind` 未配置为允许远程访问，Redis 会拒绝远程连接；请按安全策略修改配置。

---

## 结语
本文为面向个人服务器的实用部署指南，覆盖从快速启动到安全、备份与监控的要点。需要的话我可以：

- 生成适配你服务器的具体 `redis.conf` 与 `docker-compose.yml`（请提供主机 OS 与偏好），
- 生成用于备份的完整脚本并测试，
- 或把本文翻译为英文版。  

文件已保存为 `doc/redis_personal_server.md`，请审阅并告诉我是否需要更改或补充。