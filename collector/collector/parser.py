"""Parse PostgreSQL jsonlog records into analyzable events (FR-10, FR-12).

A relevant record looks like:
  {"timestamp": "2026-10-01 14:35:08.288 UTC", "message": "execute <unnamed>: /* app:uid=2;sid=..;rid=..;
   ip=..;ep=GET/api/products */ SELECT ...", "detail": "parameters: $1 = 'kaos'' union ...', $2 = '12'"}

Only statements carrying the application tag are analyzed; migrations, the seed script,
psql sessions etc. are ignored.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone

_TAG = re.compile(r"/\* app:(?P<body>[A-Za-z0-9=;:/_.\-]*) \*/")
_STATEMENT = re.compile(r"^(?:statement|execute [^:]*):\s*", re.IGNORECASE)
_PARAM = re.compile(r"\$(\d+) = (?:NULL|'((?:[^']|'')*)')", re.DOTALL)
_LITERAL = re.compile(r"(?<![A-Za-z0-9_])'((?:[^']|'')*)'", re.DOTALL)
_ENDPOINT = re.compile(r"^([A-Z]+)(/.*)$")

# Values the application itself binds (enums, flags, hashes, timestamps); not user input.
_TRIVIAL = [
    re.compile(r"^-?\d+(\.\d+)?$"),                                   # numbers
    re.compile(r"^(t|f|true|false)$", re.IGNORECASE),                 # booleans
    re.compile(r"^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?([+-]\d{2}(:?\d{2})?|Z)?)?$"),  # dates
    re.compile(r"^\$argon2(id|i|d)\$"),                               # password hashes
    re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE),  # uuid
]
_INTERNAL_CONSTANTS = {"user", "admin", "active", "suspended", "pending", "paid", "shipped", "completed",
                       "cancelled", "Normal", "SQLi", "None", "Low", "Medium", "High"}


@dataclass
class LogEvent:
    timestamp: datetime
    user_id: int | None
    session_id: str | None
    request_id: str | None
    ip: str | None
    endpoint: str | None
    statement: str
    values: list[str] = field(default_factory=list)


def parse_tag(body: str) -> dict[str, str | None]:
    out: dict[str, str | None] = {}
    for part in body.split(";"):
        if "=" in part:
            k, v = part.split("=", 1)
            out[k] = None if v == "-" else v
    return out


def parse_timestamp(value: str | None) -> datetime:
    if value:
        try:
            # "2026-10-01 14:35:08.288 UTC"
            return datetime.strptime(value.replace(" UTC", ""), "%Y-%m-%d %H:%M:%S.%f").replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return datetime.now(timezone.utc)


def unescape_sql_string(value: str) -> str:
    return value.replace("''", "'")


def parse_parameters(detail: str | None) -> list[str]:
    if not detail or not detail.lower().startswith("parameters:"):
        return []
    return [unescape_sql_string(m.group(2)) for m in _PARAM.finditer(detail) if m.group(2) is not None]


def is_trivial(value: str) -> bool:
    v = value.strip()
    return not v or v in _INTERNAL_CONSTANTS or any(p.match(v) for p in _TRIVIAL)


def format_endpoint(raw: str | None) -> str | None:
    """The tag stores 'GET/api/products' (spaces are stripped); restore 'GET /api/products'."""
    if not raw:
        return None
    m = _ENDPOINT.match(raw)
    return f"{m.group(1)} {m.group(2)}" if m else raw


def parse_line(line: str) -> LogEvent | None:
    line = line.strip()
    if "/* app:" not in line:  # cheap pre-filter before JSON parsing
        return None
    try:
        record = json.loads(line)
    except json.JSONDecodeError:
        return None
    message = record.get("message") or ""
    m_stmt = _STATEMENT.match(message)
    if not m_stmt:
        return None
    statement = message[m_stmt.end():]
    m_tag = _TAG.match(statement)
    if not m_tag:
        return None
    tag = parse_tag(m_tag.group("body"))
    sql = statement[m_tag.end():].strip()

    values = parse_parameters(record.get("detail"))
    if not values:
        # Simple-protocol statement: values are inlined as string literals.
        values = [unescape_sql_string(m.group(1)) for m in _LITERAL.finditer(sql)]

    uid = tag.get("uid")
    return LogEvent(
        timestamp=parse_timestamp(record.get("timestamp")),
        user_id=int(uid) if uid and uid.isdigit() else None,
        session_id=tag.get("sid"),
        request_id=tag.get("rid"),
        ip=tag.get("ip"),
        endpoint=format_endpoint(tag.get("ep")),
        statement=sql,
        values=[v for v in values if not is_trivial(v)],
    )
