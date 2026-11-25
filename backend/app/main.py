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


class SecurityHeadersMiddleware:
    """OWASP A05: attach strict security headers to every HTTP response."""

    _BASE_HEADERS = [
        (b"x-content-type-options", b"nosniff"),
        (b"x-frame-options", b"DENY"),
        (b"referrer-policy", b"strict-origin-when-cross-origin"),
        (b"permissions-policy", b"camera=(), microphone=(), geolocation=(), payment=()"),
        (b"cross-origin-opener-policy", b"same-origin"),
    ]

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path = scope.get("path", "")
        sensitive = path.startswith(("/api/auth/", "/api/monitor/", "/api/profile"))

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.extend(self._BASE_HEADERS)
                if sensitive:
                    headers.append((b"cache-control", b"no-store"))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_headers)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(listen_forever())
    yield
    task.cancel()


_settings = get_settings()
app = FastAPI(
    title="KopiAman — OWASP-Hardened Coffee Shop & SQLi Monitor",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs" if _settings.enable_docs else None,
    redoc_url="/redoc" if _settings.enable_docs else None,
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(ActorContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
for r in (auth.router, catalog.router, shop.router, admin.router, monitoring.router, monitoring.ws_router):
    app.include_router(r)


@app.get("/api/health")
def health():
    return {"status": "ok"}
