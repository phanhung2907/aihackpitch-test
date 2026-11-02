from contextlib import contextmanager
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker


class Database:
    def __init__(self, url: str):
        self.engine = create_engine(url, pool_pre_ping=True, pool_size=10, max_overflow=10)
        self.sessions = sessionmaker(self.engine, expire_on_commit=False)

    @contextmanager
    def transaction(self):
        with self.sessions.begin() as session:
            session.execute(text("SET LOCAL lock_timeout = '3s'"))
            session.execute(text("SET LOCAL statement_timeout = '10s'"))
            yield session


def rows(session: Session, sql: str, **params: Any) -> list[dict]:
    return [dict(row) for row in session.execute(text(sql), params).mappings()]


def one(session: Session, sql: str, **params: Any) -> dict | None:
    result = rows(session, sql, **params)
    return result[0] if result else None


def execute(session: Session, sql: str, **params: Any) -> None:
    session.execute(text(sql), params)


def required_one(session: Session, sql: str, **params: Any) -> dict:
    result = one(session, sql, **params)
    if result is None:
        raise RuntimeError("Expected database row is missing")
    return result
