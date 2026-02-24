"""Database connection helper.

Provides `get_connection()` that returns a DB connection based on
`config.config.DATABASE_URL`. If the URL points to Postgres, uses
`psycopg2`; otherwise falls back to the project's sqlite DB.
"""
import os
import sqlite3
from typing import Any

from config.config import DATABASE_URL, DB_PATH

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except Exception:
    psycopg2 = None


def get_connection() -> Any:
    """Return a DB connection.

    - If `DATABASE_URL` looks like Postgres, return a `psycopg2` connection.
    - Otherwise return a `sqlite3` connection using `DB_PATH`.
    """
    if DATABASE_URL and DATABASE_URL.startswith(("postgres://", "postgresql://")):
        if psycopg2 is None:
            raise RuntimeError(
                "psycopg2 is required for Postgres connections. Install with: pip install psycopg2-binary"
            )
        # psycopg2 accepts a libpq connection string
        return psycopg2.connect(DATABASE_URL)

    # Fallback: ensure sqlite file directory exists
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    return sqlite3.connect(DB_PATH)


def test_connection() -> bool:
    """Simple smoke test: open connection and run a trivial query.

    Returns True on success, False on failure.
    """
    try:
        conn = get_connection()
        cur = conn.cursor()
        # Works for both Postgres and SQLite
        cur.execute("SELECT 1")
        _ = cur.fetchone()
        cur.close()
        conn.close()
        return True
    except Exception:
        return False
