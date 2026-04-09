# Redis 使用说明（本项目）

## 概要
本项目使用 Redis 作为轻量级缓存、任务队列与会话持久化储层，并用于一些轻量控制（例如防重复和 JWT 主动吊销）。核心实现位于 [app/core/redis_client.py](app/core/redis_client.py)。Redis 的不可达会被静默降级，不影响主流程。

## 主要用途一览
- LLM 结果缓存：`llm:cache:<sha256>`（TTL 1 小时），由 `get_llm_cache` / `set_llm_cache` 管理，减少对 LLM 的重复调用（见 [app/core/llm.py](app/core/llm.py)）。
- 会话状态持久化：
  - `chat:history:<bot_id>`（TTL 7 天）——用于会话窗口最近历史的持久化与重启恢复。
  - `chat:history_today:<bot_id>`（TTL 25 小时）——用于积累当天完整对话以生成用户画像（画像生成后会清空）。
  相应接口：`load_history` / `save_history` / `load_history_today` / `save_history_today`（见 [app/core/redis_client.py](app/core/redis_client.py) 与 [app/core/bot_worker.py](app/core/bot_worker.py)）。
- 防重复处理：`dedup:tg:<update_id>`（TTL 10 分钟），通过 SET NX 标记 Telegram update 已处理，函数名 `mark_update`。
- 任务队列：`queue:chat`（List，生产者 `LPUSH`，消费者 `BRPOP`），函数 `enqueue` / `dequeue`，用于解耦抓取与处理（见 bot worker 的消费者逻辑）。
- JWT 版本控制（主动吊销）：`jwt:version:<user_id>`，Auth 在签发/验证时读取版本号以支持主动失效（见 [app/core/auth.py](app/core/auth.py) 的 `_get_jwt_version` / `invalidate_user_tokens`）。

## 键名与 TTL（摘录）
- `llm:cache:<sha256>` — TTL = 3600 秒（1 小时）
- `chat:history:<bot_id>` — TTL = 7 天
- `chat:history_today:<bot_id>` — TTL = 25 小时
- `dedup:tg:<update_id>` — TTL = 600 秒（10 分钟）
- `queue:chat` — 列表（无固定 TTL，由生产/消费维持）
- `jwt:version:<user_id>` — 无固定 TTL（持久，直到被显式修改）

## 容错/降级行为
项目设计中 Redis 是可选的辅助层：若 Redis 不可达，相关调用会静默降级，不阻断主流程，典型行为如下：
- 缓存：`get_llm_cache` 返回 `None`，`set_llm_cache` 无操作。
- 会话：`load_history` / `load_history_today` 返回空列表，`save_history*` 无操作。
- 防重复：`mark_update` 在 Redis 不可达时返回 `True`（允许处理）。
- 队列：`enqueue` 在 Redis 不可达时返回 `False`（调用方会直接处理消息），`dequeue` 返回 `None`。
详见 [app/core/redis_client.py](app/core/redis_client.py) 的实现注释。

## 本地开发与调试
- 默认配置（见 [app/config.py](app/config.py)）使用 `REDIS_URL`，默认 `redis://localhost:6380`。
- 使用 Docker 快速启动 Redis（将容器内部 6379 映射到宿主 6380）：

```bash
docker run -p 6380:6379 --name xiaoxing-redis -d redis:7
```

- 使用 redis-cli 测试：

```bash
redis-cli -p 6380 PING
redis-cli -p 6380 KEYS "chat:history*"
redis-cli -p 6380 LRANGE queue:chat 0 -1
```

- 检查队列空与否：`LRANGE queue:chat 0 -1`；如果队列一直为空并且 bot 未处理消息，检查 REDIS_URL、容器是否在运行、以及应用日志。

## 常用维护命令示例
- 查看当天有历史的 bot_id：
  - 在 Python 中调用 `get_today_bot_ids()`（已实现）或在 redis-cli 中使用 `KEYS chat:history_today:*`。
- 清空今日历史（谨慎操作）：

```bash
# 取回键并删除（简单示例）
redis-cli -p 6380 KEYS "chat:history_today:*" | xargs -r redis-cli -p 6380 DEL
```

## 运维与安全建议
- 若对外暴露 Redis，请启用认证与 TLS，或把 Redis 放在受限内网。不要把未授权的 Redis 暴露到公网。
- 根据数据重要性考虑持久化（RDB / AOF）与备份策略。对像 `jwt:version:*` 这类键通常要持久化；而 `llm:cache:*` 可短期缓存。
- 根据并发量配置内存限制与淘汰策略（maxmemory、eviction policy），避免 OOM。

## 参考代码位置
- Redis 抽象与工具： [app/core/redis_client.py](app/core/redis_client.py)
- Bot 消费者与历史管理： [app/core/bot_worker.py](app/core/bot_worker.py)
- LLM 缓存调用点： [app/core/llm.py](app/core/llm.py)
- JWT 版本控制： [app/core/auth.py](app/core/auth.py)

---
如需我把这份文档调整为英文版、添加更多运维示例（systemd / docker-compose / k8s snippet），或把某一小节展开成更详尽的运维手册，我可以继续完善。

## 运维部署示例与更详细的安全指南

下面提供几个常见部署场景示例（仅供参考），并给出安全、备份与监控建议。实际生产环境请结合公司安全策略与云平台能力进行调整。

### 1) Docker Compose（单机 / 测试 / 小型生产）

示例 `docker-compose.yml`（将数据持久化并通过环境/配置文件设置密码）：

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
      - "6380:6379"   # 开发时可映射到主机 6380 端口（生产环境建议不外网映射）
    restart: unless-stopped
    networks:
      - internal

volumes:
  redis-data:

networks:
  internal:
    driver: bridge
```

示例 `redis/redis.conf`（关键配置）：

```
bind 0.0.0.0
requirepass your_very_strong_password_here
protected-mode yes
appendonly yes
appendfsync everysec
save 900 1
save 300 10
save 60 10000
maxmemory 1gb
maxmemory-policy allkeys-lru
```

要点：
- 在生产环境尽量不要把 Redis 端口映射到公网；将服务放在私有网络并只允许后端应用访问。  
- 密码应使用 Docker secrets / 环境变量或 Kubernetes Secret 管理，不要硬编码在 repo 中。  
- `appendonly` 开启 AOF 可减少数据丢失，结合 RDB 快照可以更快恢复。根据写入量调整 `appendfsync` 策略。

### 2) systemd（在宿主机直接安装 redis-server）

1. 安装（Debian/Ubuntu）：

```bash
sudo apt update
sudo apt install redis-server
```

2. 编辑 `/etc/redis/redis.conf`，设置 `requirepass`、持久化与内存策略（如上所示）。  
3. 使用 systemd 管理服务：

```bash
sudo systemctl enable redis-server
sudo systemctl start redis-server
sudo systemctl status redis-server
```

注意在生产环境把 `bind` 设置为内部地址（如 `127.0.0.1` 或私有网卡 IP），并通过防火墙限制访问。

### 3) Kubernetes（建议使用官方 Helm chart / operator）

最简单的 StatefulSet 示例（仅演示持久化与 Secret 注入，生产推荐使用 `bitnami/redis` 或 `redis` Helm chart`）：

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: redis-secret
type: Opaque
data:
  redis-password: <base64-encoded-password>

---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
spec:
  serviceName: "redis"
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7
        args: ["redis-server", "/etc/redis/redis.conf"]
        volumeMounts:
        - name: config
          mountPath: /etc/redis/redis.conf
          subPath: redis.conf
        - name: data
          mountPath: /data
        env:
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: redis-password
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi

---
apiVersion: v1
kind: Service
metadata:
  name: redis
spec:
  ports:
  - port: 6379
    name: redis
  clusterIP: None
  selector:
    app: redis
```

要点：使用 Helm chart（例如 `bitnami/redis`）可以更方便得启用主从、持久化、密码和 TLS，并有更多成熟的配置选项与健康检查。

### 4) 高可用与扩展（简要建议）
- 简单主从复制 + Sentinel（用于发现与主节点故障转移），适用于读写分离和基本高可用。  
- Redis Cluster：水平扩展（分片），适合需要大规模内存与吞吐量的场景。  
- 对于生产强可用，优先考虑云托管服务（如 AWS ElastiCache、Azure Cache for Redis、GCP Memorystore）或成熟的 Helm chart/operator。

### 5) 备份与恢复
- 使用 RDB（快照）或 AOF（追加日志）策略。AOF 提供更小的数据丢失窗口但文件较大。  
- 定期将 RDB/AOF 文件同步到外部存储（S3、对象存储）并做版本化备份；恢复时先验证文件完整性。  
- 常用命令：`BGSAVE`（触发后台 RDB）、`BGREWRITEAOF`（压缩 AOF）、`redis-cli --rdb`（导出）。

### 6) 监控与告警
- 使用 `redis_exporter`（如 `oliver006/redis_exporter`）配合 Prometheus 采集指标，再用 Grafana 可视化。  
- 重要监控指标：连接数、内存使用、evictions（驱逐）、instantaneous_ops_per_sec、keyspace_hits/misses、aof_rewrites、rdb_bgsave_in_progress。  
- 告警示例：内存使用接近阈值、evictions 非 0、RDB/AOF 持久化失败、主从同步延迟过高。

示例 Prometheus scrape 配置（简化）：

```yaml
- job_name: 'redis'
  static_configs:
    - targets: ['redis-exporter:9121']
```

### 7) 安全建议（要点汇总）
- 网络：将 Redis 放在私有子网，使用 VPC/防火墙限制访问来源。避免直接暴露到公网。  
- 认证：启用 `requirepass` 或使用 Redis ACL（`ACL SETUSER`）限制权限与账号分级。  
- 加密：在跨机通信或公网场景下使用 TLS（若使用的镜像/部署支持），或在入口处使用 TLS 代理（stunnel/HAProxy）。  
- 密钥管理：不要把密码写入代码仓库；使用环境变量、Docker Secret、Kubernetes Secret 或云平台 Secret 管理服务。  
- 最小权限：应用端只使用必要的账号/权限（可用 ACL 将写权限和管理权限区分）。

---