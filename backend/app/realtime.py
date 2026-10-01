"""Real-time push of detections to admin dashboards (FR-18).

The detector service writes a row into attack_logs and issues
`NOTIFY attack_events, '<json>'`. This module LISTENs on that channel with an async
psycopg connection and fans the message out to every connected admin WebSocket.
"""
from __future__ import annotations

import asyncio
import json
import logging

import psycopg
from fastapi import WebSocket

from .config import get_settings

log = logging.getLogger("realtime")


class ConnectionManager:
    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._clients.add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self._clients.discard(ws)

    async def broadcast(self, message: dict) -> None:
        dead = []
        for ws in list(self._clients):
            try:
                await ws.send_json(message)
            except Exception:  # client went away
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    @property
    def count(self) -> int:
        return len(self._clients)


manager = ConnectionManager()


def _libpq_url(sqlalchemy_url: str) -> str:
    return sqlalchemy_url.replace("postgresql+psycopg://", "postgresql://", 1)


async def listen_forever() -> None:
    settings = get_settings()
    if not settings.database_url.startswith("postgresql"):
        return
    channel = settings.notify_channel
    while True:
        try:
            async with await psycopg.AsyncConnection.connect(
                _libpq_url(settings.database_url), autocommit=True, application_name="shop-realtime"
            ) as conn:
                await conn.execute(f'LISTEN "{channel}"')  # channel comes from config, not user input
                log.info("listening on channel %s", channel)
                async for notify in conn.notifies():
                    try:
                        await manager.broadcast({"type": "detection", "data": json.loads(notify.payload)})
                    except json.JSONDecodeError:
                        log.warning("bad notify payload")
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # DB restart etc. -> retry
            log.warning("listener error: %s; retrying in 3s", exc)
            await asyncio.sleep(3)
