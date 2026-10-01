from __future__ import annotations

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import get_settings
from .request_context import current_actor


class Base(DeclarativeBase):
    pass


def _make_engine():
    url = get_settings().database_url
    kwargs: dict = {"pool_pre_ping": True}
    if url.startswith("postgresql"):
        # Disable automatic server-side prepared statements so every execution is logged
        # in the same "execute <unnamed>: ... / parameters: $1 = '...'" shape.
        kwargs["connect_args"] = {"prepare_threshold": None, "application_name": "shop-backend"}
    elif url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    return create_engine(url, **kwargs)


engine = _make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@event.listens_for(engine, "before_cursor_execute", retval=True)
def _tag_statement(conn, cursor, statement, parameters, context, executemany):
    """Prepend '/* app:uid=..;sid=..;ip=..;ep=.. */' so the log collector can attribute
    every logged query to the user/session/endpoint that caused it (FR-10, FR-12).
    Only the comment is added; the values themselves are still bound parameters."""
    actor = current_actor.get()
    if actor is not None:
        statement = actor.sql_tag() + statement
    return statement, parameters


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
