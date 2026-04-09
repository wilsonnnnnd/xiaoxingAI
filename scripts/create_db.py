#!/usr/bin/env python3
"""
scripts/create_db.py

Create PostgreSQL database referenced by POSTGRES_DSN (from .env or --dsn).
Optionally call `app.db.init_db()` to initialize tables.

Usage:
  python scripts/create_db.py [--dsn DSN] [--db-name NAME] [--init]

Examples:
  # create DB from .env's POSTGRES_DSN
  python scripts/create_db.py

  # create DB and initialize schema
  python scripts/create_db.py --init

  # provide custom DSN
  python scripts/create_db.py --dsn postgresql://postgres:pwd@db:5432/xiaoxing --init
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from urllib.parse import urlparse, unquote

import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv


def parse_dsn(dsn: str) -> dict:
    p = urlparse(dsn)
    if p.scheme not in ("postgresql", "postgres"):
        raise ValueError("Unsupported DSN scheme: %s" % p.scheme)
    return {
        "user": unquote(p.username) if p.username else None,
        "password": unquote(p.password) if p.password else None,
        "host": p.hostname or "localhost",
        "port": p.port or 5432,
        "dbname": p.path.lstrip("/") if p.path and p.path != "/" else None,
    }


def build_dsn(parsed: dict, dbname: str) -> str:
    user = parsed.get("user")
    password = parsed.get("password")
    host = parsed.get("host") or "localhost"
    port = parsed.get("port")
    auth = ""
    if user:
        auth = user
        if password:
            auth += ":" + password
        auth += "@"
    hostport = host + (f":{port}" if port else "")
    return f"postgresql://{auth}{hostport}/{dbname}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Create PostgreSQL database and optionally initialize schema.")
    parser.add_argument("--dsn", help="Postgres DSN (overrides POSTGRES_DSN env or .env)")
    parser.add_argument("--db-name", help="Database name to create (overrides DSN path)")
    parser.add_argument("--owner", help="Database owner (optional)")
    parser.add_argument("--init", action="store_true", help="After creating DB, call app.db.init_db() to create tables")
    parser.add_argument("--env-file", help="Path to .env file to load (default: project .env)", default=None)
    args = parser.parse_args()

    # Load .env (project root) unless a specific file is provided
    if args.env_file:
        load_dotenv(args.env_file)
    else:
        repo_root = Path(__file__).resolve().parent.parent
        load_dotenv(repo_root / ".env")

    dsn = args.dsn or os.environ.get("POSTGRES_DSN") or "postgresql://postgres:postgres@localhost:5432/xiaoxing"
    parsed = parse_dsn(dsn)
    target_db = args.db_name or parsed.get("dbname") or "xiaoxing"
    owner = args.owner or parsed.get("user")

    admin_db = "postgres"

    conn_kwargs = {}
    if parsed.get("user"):
        conn_kwargs["user"] = parsed["user"]
    if parsed.get("password"):
        conn_kwargs["password"] = parsed["password"]
    if parsed.get("host"):
        conn_kwargs["host"] = parsed["host"]
    if parsed.get("port"):
        conn_kwargs["port"] = parsed["port"]
    conn_kwargs["dbname"] = admin_db

    try:
        print(f"Connecting to {conn_kwargs.get('host','localhost')}:{conn_kwargs.get('port',5432)} as {conn_kwargs.get('user') or 'current user'} ...")
        conn = psycopg2.connect(**conn_kwargs)
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (target_db,))
            if cur.fetchone():
                print(f"Database '{target_db}' already exists. Nothing to do.")
            else:
                if owner:
                    q = sql.SQL("CREATE DATABASE {} OWNER {}")
                    q = q.format(sql.Identifier(target_db), sql.Identifier(owner))
                else:
                    q = sql.SQL("CREATE DATABASE {}").format(sql.Identifier(target_db))
                cur.execute(q)
                print(f"Database '{target_db}' created successfully.")
        conn.close()
    except Exception as e:
        print("Failed to create database:", e)
        sys.exit(1)

    if args.init:
        # ensure DSN points to the created database
        new_dsn = build_dsn(parsed, target_db)
        os.environ["POSTGRES_DSN"] = new_dsn
        # make sure project root is on sys.path so `import app` works
        repo_root = Path(__file__).resolve().parent.parent
        sys.path.insert(0, str(repo_root))
        try:
            print("Initializing schema via app.db.init_db() ...")
            import app.db as app_db  # type: ignore
            app_db.init_db()
            print("Schema initialized.")
        except Exception as e:
            print("Failed to initialize schema:", e)
            sys.exit(1)


if __name__ == "__main__":
    main()
