from typing import Generator, Optional
from contextlib import contextmanager
import psycopg2
import psycopg2.pool
from app.core import config

# ── 连接池（懒初始化） ─────────────────────────────────────────────
_pool: Optional[psycopg2.pool.ThreadedConnectionPool] = None

def _get_pool() -> psycopg2.pool.ThreadedConnectionPool:
    global _pool
    if _pool is None:
        _pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=max(1, int(config.DB_POOL_MINCONN)),
            maxconn=max(1, int(config.DB_POOL_MAXCONN)),
            dsn=config.POSTGRES_DSN,
        )
    return _pool

@contextmanager
def _cur() -> Generator:
    """
    从连接池取一个连接，提供 cursor；成功时 commit，异常时 rollback，最终归还连接。
    """
    pool = _get_pool()
    conn = pool.getconn()
    cur = None
    try:
        cur = conn.cursor()
        yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        if cur is not None:
            cur.close()
        pool.putconn(conn)

_TS_EXPR = "to_char(NOW(), 'YYYY-MM-DDTHH24:MI:SS')"
