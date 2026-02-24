import os
import sys

# Ensure project root is on sys.path so imports like `from config import config` work
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from config import config
from db import connection


def create_postgres_tables():
    sql_path = os.path.join(os.path.dirname(__file__), "postgres_tables.sql")
    if not os.path.exists(sql_path):
        raise FileNotFoundError(f"SQL file not found: {sql_path}")

    with open(sql_path, "r", encoding="utf-8") as f:
        sql = f.read()

    conn = connection.get_connection()
    cur = conn.cursor()
    try:
        cur.execute(sql)
        conn.commit()
        print("Postgres: tables created or already exist.")
    except Exception as e:
        conn.rollback()
        print("Error creating Postgres tables:", e)
        raise
    finally:
        cur.close()
        conn.close()


def create_sqlite_tables():
    sqlite_sql = """
    CREATE TABLE IF NOT EXISTS api_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_input TEXT,
        prompt TEXT,
        response TEXT,
        response_tokens INTEGER,
        model TEXT,
        duration_ms INTEGER,
        status TEXT,
        metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        level TEXT,
        message TEXT,
        context TEXT
    );

    CREATE TABLE IF NOT EXISTS audio_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        text TEXT,
        duration_ms INTEGER,
        voice TEXT,
        style TEXT,
        rate TEXT,
        volume TEXT,
        length_bytes INTEGER,
        file_path TEXT,
        metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS audio_tone (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        audio_id INTEGER NOT NULL,
        tone TEXT,
        score REAL,
        metadata TEXT
    );

    """

    conn = connection.get_connection()
    try:
        cur = conn.cursor()
        cur.executescript(sqlite_sql)
        conn.commit()
        print("SQLite: tables created or already exist.")
    except Exception as e:
        conn.rollback()
        print("Error creating SQLite tables:", e)
        raise
    finally:
        cur.close()
        conn.close()


def main():
    url = getattr(config, "DATABASE_URL", "")
    if not (url and url.startswith(("postgres://", "postgresql://"))):
        raise RuntimeError("DATABASE_URL must be set to a Postgres URL to create tables. SQLite support has been removed.")

    create_postgres_tables()


if __name__ == "__main__":
    main()
