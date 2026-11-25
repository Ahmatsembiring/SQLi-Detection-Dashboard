from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import (Boolean, CheckConstraint, DateTime, Float, ForeignKey, Integer, Numeric, String, Text,
                        UniqueConstraint, func)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(10), default="user")  # 'user' | 'admin'
    status: Mapped[str] = mapped_column(String(12), default="active")  # 'active' | 'suspended'
    phone: Mapped[str | None] = mapped_column(String(30))
    address: Mapped[str | None] = mapped_column(Text)
    avatar_url: Mapped[str | None] = mapped_column(Text)
    bio: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("role in ('user','admin')", name="ck_users_role"),
        CheckConstraint("status in ('active','suspended')", name="ck_users_status"),
    )


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    description: Mapped[str | None] = mapped_column(Text)


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"), index=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    stock: Mapped[int] = mapped_column(Integer, default=0)
    image_url: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    category: Mapped[Category | None] = relationship()

    __table_args__ = (CheckConstraint("price >= 0", name="ck_products_price"),
                      CheckConstraint("stock >= 0", name="ck_products_stock"))


class CartItem(Base):
    __tablename__ = "cart_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    quantity: Mapped[int] = mapped_column(Integer, default=1)

    product: Mapped[Product] = relationship()

    __table_args__ = (UniqueConstraint("user_id", "product_id", name="uq_cart_user_product"),
                      CheckConstraint("quantity > 0", name="ck_cart_qty"))


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    total: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    shipping_address: Mapped[str] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship()
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("status in ('pending','paid','shipped','completed','cancelled')", name="ck_orders_status"),
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"))
    product_name: Mapped[str] = mapped_column(String(200))  # snapshot, survives product deletion
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    quantity: Mapped[int] = mapped_column(Integer)

    order: Mapped[Order] = relationship(back_populates="items")


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship()

    __table_args__ = (CheckConstraint("rating between 1 and 5", name="ck_reviews_rating"),)


class AttackLog(Base):
    """One row per classified user-supplied value extracted from the database query log.

    Written by the detector service (collector/), read and annotated by the admin API.
    Both Normal and SQLi results are stored so the dashboard can show the ratio.
    """
    __tablename__ = "attack_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)  # time of the query (DB log)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    attempted_username: Mapped[str | None] = mapped_column(String(255))  # FR-12: failed/anonymous logins
    session_id: Mapped[str | None] = mapped_column(String(64))
    ip: Mapped[str | None] = mapped_column(String(45))
    endpoint: Mapped[str | None] = mapped_column(String(200))
    raw_payload: Mapped[str] = mapped_column(Text)
    normalized_payload: Mapped[str] = mapped_column(Text)
    query_text: Mapped[str | None] = mapped_column(Text)
    label: Mapped[str] = mapped_column(String(10), index=True)  # 'Normal' | 'SQLi'
    probability: Mapped[float] = mapped_column(Float)
    severity: Mapped[str] = mapped_column(String(10), default="None")
    latency_ms: Mapped[float] = mapped_column(Float)  # model inference time (FR-19)
    pipeline_delay_ms: Mapped[float | None] = mapped_column(Float)  # DB log time -> stored (end-to-end)
    is_false_positive: Mapped[bool] = mapped_column(Boolean, default=False)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    user: Mapped[User | None] = relationship(foreign_keys=[user_id])
