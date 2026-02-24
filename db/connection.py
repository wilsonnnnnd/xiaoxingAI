"""Database connection helper.

Provides `get_connection()` that returns a DB connection based on
`config.config.DATABASE_URL`. If the URL points to Postgres, uses
`psycopg2`; otherwise falls back to the project's sqlite DB.
"""
import os
import sqlite3
from typing import Any

from config.config import DATABASE_URL

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except Exception:
    psycopg2 = None


def get_connection() -> Any:
    """Return a DB connection.

    - Only Postgres is supported. Returns a `psycopg2` connection.
    """
    if not (DATABASE_URL and DATABASE_URL.startswith(("postgres://", "postgresql://"))):
        raise RuntimeError(
            "Postgres DATABASE_URL is required. Set the DATABASE_URL environment variable to a Postgres connection string."
        )

    if psycopg2 is None:
        raise RuntimeError(
            "psycopg2 is required for Postgres connections. Install with: pip install psycopg2-binary"
        )

    # psycopg2 accepts a libpq connection string
    return psycopg2.connect(DATABASE_URL)


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
