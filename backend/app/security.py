from __future__ import annotations

import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from .config import get_settings

_hasher = PasswordHasher()
# Verifying against a dummy hash for unknown emails keeps login timing uniform (no user enumeration).
_DUMMY_HASH = _hasher.hash(secrets.token_hex(16))


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerificationError, InvalidHashError):
        return False


def validate_password_strength(password: str) -> str:
    """OWASP ASVS 2.1: require length >= 8 with uppercase, lowercase, and a digit."""
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if not any(c.islower() for c in password):
        raise ValueError("Password must contain at least one lowercase letter")
    if not any(c.isupper() for c in password):
        raise ValueError("Password must contain at least one uppercase letter")
    if not any(c.isdigit() for c in password):
        raise ValueError("Password must contain at least one number")
    return password


def create_access_token(user_id: int, role: str) -> tuple[str, str]:
    s = get_settings()
    now = datetime.now(timezone.utc)
    session_id = secrets.token_hex(8)
    payload = {
        "sub": str(user_id),
        "role": role,
        "sid": session_id,
        "jti": secrets.token_hex(12),
        "iss": s.jwt_issuer,
        "iat": now,
        "exp": now + timedelta(minutes=s.jwt_expire_minutes),
    }
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm), session_id


def decode_token(token: str) -> dict:
    s = get_settings()
    return jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm], issuer=s.jwt_issuer)


def verify_google_id_token(credential: str, client_id: str) -> dict:
    """Verify a Google Identity Services ID token (signature, aud, iss, exp, email_verified)."""
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token

    info = id_token.verify_oauth2_token(credential, google_requests.Request(), client_id)
    if info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise ValueError("Invalid Google token issuer")
    if not info.get("email") or not info.get("email_verified"):
        raise ValueError("Google account email is not verified")
    return info


class SlidingWindowRateLimiter:
    """OWASP A07: lightweight per-IP sliding-window rate limiter for auth endpoints."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str, max_requests: int, window_seconds: int) -> tuple[bool, int]:
        if max_requests <= 0:
            return True, 0
        now = time.monotonic()
        cutoff = now - window_seconds
        bucket = self._hits[key]
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()
        if len(bucket) >= max_requests:
            retry_after = max(1, int(window_seconds - (now - bucket[0])) + 1)
            return False, retry_after
        bucket.append(now)
        return True, 0

    def reset(self) -> None:
        self._hits.clear()


auth_rate_limiter = SlidingWindowRateLimiter()
