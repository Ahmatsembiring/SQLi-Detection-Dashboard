"""Persist detections (FR-17) and publish them for the live dashboard (FR-18)."""
from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone

import psycopg

log = logging.getLogger("collector.store")

INSERT_SQL = """
INSERT INTO attack_logs (timestamp, detected_at, user_id, attempted_username, session_id, ip, endpoint,
                         raw_payload, normalized_payload, query_text, label, probability, severity,
                         latency_ms, pipeline_delay_ms, is_false_positive)
VALUES (%(timestamp)s, %(detected_at)s, %(user_id)s, %(attempted_username)s, %(session_id)s, %(ip)s,
        %(endpoint)s, %(raw_payload)s, %(normalized_payload)s, %(query_text)s, %(label)s, %(probability)s,
        %(severity)s, %(latency_ms)s, %(pipeline_delay_ms)s, false)
RETURNING id
"""


class Store:
    """Uses the 'detector' DB role, whose own statements are excluded from logging
    (ALTER ROLE detector SET log_statement='none'), so writes here never loop back."""

    def __init__(self, dsn: str, channel: str = "attack_events"):
        self.dsn = dsn
        self.channel = channel
        self.conn: psycopg.Connection | None = None
        self._names: dict[int, tuple[str, float]] = {}

    def connect(self) -> None:
        while True:
            try:
                self.conn = psycopg.connect(self.dsn, autocommit=True, application_name="sqli-collector")
                log.info("connected to database")
                return
            except psycopg.OperationalError as exc:
                log.warning("database not ready (%s); retrying", exc)
                time.sleep(2)

    def _ensure(self) -> psycopg.Connection:
        if self.conn is None or self.conn.closed:
            self.connect()
        return self.conn

    def username(self, user_id: int | None) -> str | None:
        if user_id is None:
            return None
        cached = self._names.get(user_id)
        if cached and time.monotonic() - cached[1] < 60:
            return cached[0]
        row = self._ensure().execute("SELECT name FROM users WHERE id = %s", (user_id,)).fetchone()
        name = row[0] if row else None
        self._names[user_id] = (name, time.monotonic())
        return name

    def save(self, row: dict) -> int:
        conn = self._ensure()
        row = {**row, "detected_at": datetime.now(timezone.utc)}
        row["pipeline_delay_ms"] = round((row["detected_at"] - row["timestamp"]).total_seconds() * 1000, 3)
        try:
            new_id = conn.execute(INSERT_SQL, row).fetchone()[0]
        except psycopg.OperationalError:
            self.conn = None  # reconnect once and retry
            new_id = self._ensure().execute(INSERT_SQL, row).fetchone()[0]

        event = {
            "id": new_id,
            "timestamp": row["timestamp"].isoformat(),
            "user_id": row["user_id"],
            "username": self.username(row["user_id"]),
            "attempted_username": row["attempted_username"],
            "ip": row["ip"],
            "endpoint": row["endpoint"],
            "raw_payload": row["raw_payload"][:1000],  # NOTIFY payloads are limited to 8000 bytes
            "label": row["label"],
            "probability": row["probability"],
            "severity": row["severity"],
            "latency_ms": row["latency_ms"],
            "pipeline_delay_ms": row["pipeline_delay_ms"],
        }
        conn.execute("SELECT pg_notify(%s, %s)", (self.channel, json.dumps(event)))
        return new_id
