from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user
from ..models import User
from ..request_context import current_actor
from ..schemas import LoginIn, RegisterIn, TokenOut, UserOut
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _token_response(user: User) -> TokenOut:
    token, session_id = create_access_token(user.id, user.role)
    actor = current_actor.get()
    if actor is not None:
        actor.user_id, actor.session_id = user.id, session_id
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/register", response_model=TokenOut, status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    user = User(name=body.name.strip(), email=email, password_hash=hash_password(body.password), role="user")
    db.add(user)
    db.commit()
    return _token_response(user)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    # The email is a bound parameter -> safe. It is still written to the DB log, where an
    # injection attempt here is detected and attributed to the client IP (FR-12).
    user = db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if user.status != "active":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account suspended")
    return _token_response(user)


@router.post("/logout", status_code=204)
def logout(_: User = Depends(get_current_user)):
    # JWTs are stateless; the client discards the token. Endpoint exists for symmetry/auditing.
    return None


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
