from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from .security import validate_password_strength


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---- auth / users --------------------------------------------------------------------------
class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def check_password_strength(cls, v: str) -> str:
        return validate_password_strength(v)


class LoginIn(BaseModel):
    # Plain str (not EmailStr) on purpose: the login form is a monitored input point,
    # so whatever the user types must reach the database query and therefore the log.
    email: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class GoogleAuthIn(BaseModel):
    credential: str = Field(min_length=20, max_length=4096)


class UserOut(ORM):
    id: int
    name: str
    email: str
    role: str
    status: str
    phone: str | None = None
    address: str | None = None
    created_at: datetime | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProfileUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    phone: str | None = Field(None, max_length=30)
    address: str | None = Field(None, max_length=500)


class PasswordChange(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def check_new_password_strength(cls, v: str) -> str:
        return validate_password_strength(v)


# ---- catalog -------------------------------------------------------------------------------
class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str | None = Field(None, max_length=1000)


class CategoryOut(ORM):
    id: int
    name: str
    description: str | None = None


class ProductIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(None, max_length=5000)
    price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    stock: int = Field(ge=0)
    category_id: int | None = None
    image_url: str | None = Field(None, max_length=500)
    is_active: bool = True

    @field_validator("image_url")
    @classmethod
    def check_safe_image_url(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        cleaned = v.strip()
        if not (cleaned.startswith("https://") or cleaned.startswith("http://") or cleaned.startswith("/")):
            raise ValueError("image_url must start with https://, http://, or /")
        return cleaned


class ProductOut(ORM):
    id: int
    name: str
    description: str | None
    price: Decimal
    stock: int
    category_id: int | None
    category: CategoryOut | None = None
    image_url: str | None
    is_active: bool
    avg_rating: float | None = None
    review_count: int = 0


class ProductPage(BaseModel):
    items: list[ProductOut]
    total: int
    page: int
    size: int


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=1, max_length=2000)


class ReviewOut(ORM):
    id: int
    product_id: int
    user_id: int
    user_name: str
    rating: int
    comment: str
    created_at: datetime


# ---- cart / orders -------------------------------------------------------------------------
class CartIn(BaseModel):
    product_id: int
    quantity: int = Field(1, ge=1, le=99)


class CartQty(BaseModel):
    quantity: int = Field(ge=1, le=99)


class CartItemOut(ORM):
    id: int
    product_id: int
    quantity: int
    product: ProductOut


class CheckoutIn(BaseModel):
    shipping_address: str = Field(min_length=5, max_length=500)
    note: str | None = Field(None, max_length=500)


class OrderItemOut(ORM):
    id: int
    product_id: int | None
    product_name: str
    price: Decimal
    quantity: int


class OrderOut(ORM):
    id: int
    user_id: int
    status: str
    total: Decimal
    shipping_address: str
    note: str | None
    created_at: datetime
    items: list[OrderItemOut]


class AdminOrderOut(OrderOut):
    user_name: str | None = None
    user_email: str | None = None


class OrderStatusIn(BaseModel):
    status: str = Field(pattern="^(pending|paid|shipped|completed|cancelled)$")


class UserStatusIn(BaseModel):
    status: str = Field(pattern="^(active|suspended)$")


class UserRoleIn(BaseModel):
    role: str = Field(pattern="^(user|admin)$")


# ---- monitoring ----------------------------------------------------------------------------
class AttackLogOut(ORM):
    id: int
    timestamp: datetime
    detected_at: datetime | None
    user_id: int | None
    username: str | None = None
    attempted_username: str | None
    session_id: str | None
    ip: str | None
    endpoint: str | None
    raw_payload: str
    normalized_payload: str
    query_text: str | None = None
    label: str
    probability: float
    severity: str
    latency_ms: float
    pipeline_delay_ms: float | None
    is_false_positive: bool


class AttackLogPage(BaseModel):
    items: list[AttackLogOut]
    total: int
    page: int
    size: int


class FalsePositiveIn(BaseModel):
    is_false_positive: bool = True
