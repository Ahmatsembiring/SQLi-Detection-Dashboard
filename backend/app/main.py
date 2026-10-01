from __future__ import annotations

import asyncio
import ipaddress
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .realtime import listen_forever
from .request_context import RequestActor, current_actor
from .routers import admin, auth, catalog, monitoring, shop

logging.basicConfig(level=logging.INFO)


class ActorContextMiddleware:
    """Pure ASGI middleware: create one mutable RequestActor per request (IP + endpoint).
    The auth dependency later fills in user_id/session_id on the same object."""

    def __init__(self, app):
        self.app = app
        self.trust_proxy = get_settings().trust_proxy_headers

    def _client_ip(self, scope) -> str | None:
        if self.trust_proxy:
            for name, value in scope.get("headers", []):
                if name == b"x-forwarded-for":
                    candidate = value.decode("latin-1").split(",")[0].strip()
                    try:
                        return str(ipaddress.ip_address(candidate))
                    except ValueError:
                        break
        client = scope.get("client")
        return client[0] if client else None

    async def __call__(self, scope, receive, send):
        if scope["type"] not in ("http", "websocket"):
            return await self.app(scope, receive, send)
        actor = RequestActor(ip=self._client_ip(scope), endpoint=f'{scope.get("method", "WS")} {scope["path"]}')
        token = current_actor.set(actor)
        try:
            await self.app(scope, receive, send)
        finally:
            current_actor.reset(token)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(listen_forever())
    yield
    task.cancel()


app = FastAPI(title="TokoAman - SQLi monitored e-commerce", version="1.0.0", lifespan=lifespan)
app.add_middleware(ActorContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in get_settings().cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
for r in (auth.router, catalog.router, shop.router, admin.router, monitoring.router, monitoring.ws_router):
    app.include_router(r)


@app.get("/api/health")
def health():
    return {"status": "ok"}
