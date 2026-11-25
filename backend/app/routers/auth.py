import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..deps import get_current_user
from ..models import User
from ..request_context import current_actor
from ..schemas import GoogleAuthIn, LoginIn, RegisterIn, TokenOut, UserOut
from ..security import (
    auth_rate_limiter,
    create_access_token,
    hash_password,
    verify_google_id_token,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _enforce_rate_limit(scope: str) -> None:
    s = get_settings()
    actor = current_actor.get()
    ip = actor.ip if actor and actor.ip else "unknown"
    allowed, retry_after = auth_rate_limiter.check(
        f"{scope}:{ip}", s.auth_rate_limit_max, s.auth_rate_limit_window_seconds
    )
    if not allowed:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Too many {scope} attempts. Please retry in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )


def _token_response(user: User) -> TokenOut:
    token, session_id = create_access_token(user.id, user.role)
    actor = current_actor.get()
    if actor is not None:
        actor.user_id, actor.session_id = user.id, session_id
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/register", response_model=TokenOut, status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    _enforce_rate_limit("register")
    email = body.email.lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    user = User(name=body.name.strip(), email=email, password_hash=hash_password(body.password), role="user")
    db.add(user)
    db.commit()
    return _token_response(user)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    _enforce_rate_limit("login")
    # The email is a bound parameter -> safe. It is still written to the DB log, where an
    # injection attempt here is detected and attributed to the client IP (FR-12).
    user = db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if user.status != "active":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account suspended")
    return _token_response(user)


@router.get("/providers")
def auth_providers():
    """Public configuration telling the frontend which OAuth providers are enabled."""
    s = get_settings()
    cid = s.google_client_id.strip()
    return {"google_enabled": bool(cid), "google_client_id": cid or None}


@router.post("/google", response_model=TokenOut)
def google_auth(body: GoogleAuthIn, db: Session = Depends(get_db)):
    """Sign in or register via Google (Gmail) using a verified Google Identity Services ID token."""
    _enforce_rate_limit("google")
    client_id = get_settings().google_client_id.strip()
    if not client_id:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google login is not configured on the server")
    try:
        info = verify_google_id_token(body.credential, client_id)
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or unverified Google credential")

    email = info["email"].strip().lower()
    name = (info.get("name") or email.split("@")[0]).strip()[:100]
    picture = info.get("picture")
    safe_picture = picture if isinstance(picture, str) and picture.startswith("https://") else None
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        # Auto-register new Gmail user with a random unguessable Argon2id password hash.
        user = User(
            name=name,
            email=email,
            password_hash=hash_password(secrets.token_urlsafe(32)),
            role="user",
            avatar_url=safe_picture,
        )
        db.add(user)
        db.commit()
    else:
        if user.status != "active":
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Account suspended")
        if not user.avatar_url and safe_picture:
            user.avatar_url = safe_picture
            db.commit()
    return _token_response(user)


@router.post("/logout", status_code=204)
def logout(_: User = Depends(get_current_user)):
    # JWTs are stateless; the client discards the token. Endpoint exists for symmetry/auditing.
    return None


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
