"""Per-request actor information, used to tag every SQL statement (FR-10).

A ContextVar is set by middleware / auth dependency and read by the SQLAlchemy
cursor hook in db.py, so no router code has to pass the user around manually.
"""
from __future__ import annotations

import ipaddress
import re
from contextvars import ContextVar
from dataclasses import dataclass

_SAFE = re.compile(r"[^A-Za-z0-9/_.\-]")


@dataclass
class RequestActor:
    user_id: int | None = None
    session_id: str | None = None
    ip: str | None = None
    endpoint: str | None = None

    def sql_tag(self) -> str:
        """Render the actor as a SQL comment. Every field is strictly sanitized: the tag is
        built from request data, so it must never be able to close the comment ('*/') or
        contain '%' (psycopg placeholder syntax)."""
        uid = str(int(self.user_id)) if self.user_id is not None else "-"
        sid = _SAFE.sub("", self.session_id or "")[:64] or "-"
        ep = _SAFE.sub("", self.endpoint or "")[:120] or "-"
        ip = "-"
        if self.ip:
            try:
                ip = str(ipaddress.ip_address(self.ip))
            except ValueError:
                pass
        return f"/* app:uid={uid};sid={sid};ip={ip};ep={ep} */ "


current_actor: ContextVar[RequestActor | None] = ContextVar("current_actor", default=None)
