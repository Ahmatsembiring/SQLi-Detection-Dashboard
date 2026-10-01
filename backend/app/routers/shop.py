"""Cart, checkout, order history and profile (FR-04, FR-05)."""
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from ..db import get_db
from ..deps import get_current_user
from ..models import CartItem, Order, OrderItem, Product, User
from ..schemas import (CartIn, CartItemOut, CartQty, CheckoutIn, OrderOut, PasswordChange, ProfileUpdate,
                       UserOut)
from ..security import hash_password, verify_password

router = APIRouter(prefix="/api", tags=["shop"])


def _cart(db: Session, user: User) -> list[CartItem]:
    return list(db.scalars(select(CartItem).options(joinedload(CartItem.product).joinedload(Product.category))
                           .where(CartItem.user_id == user.id).order_by(CartItem.id)).all())


@router.get("/cart", response_model=list[CartItemOut])
def get_cart(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _cart(db, user)


@router.post("/cart", response_model=list[CartItemOut], status_code=201)
def add_to_cart(body: CartIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    product = db.get(Product, body.product_id)
    if product is None or not product.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    item = db.scalar(select(CartItem).where(CartItem.user_id == user.id, CartItem.product_id == product.id))
    if item:
        item.quantity = min(item.quantity + body.quantity, 99)
    else:
        db.add(CartItem(user_id=user.id, product_id=product.id, quantity=body.quantity))
    db.commit()
    return _cart(db, user)


@router.patch("/cart/{item_id}", response_model=list[CartItemOut])
def update_cart(item_id: int, body: CartQty, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = db.get(CartItem, item_id)
    if item is None or item.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cart item not found")
    item.quantity = body.quantity
    db.commit()
    return _cart(db, user)


@router.delete("/cart/{item_id}", response_model=list[CartItemOut])
def remove_from_cart(item_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = db.get(CartItem, item_id)
    if item is None or item.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cart item not found")
    db.delete(item)
    db.commit()
    return _cart(db, user)


@router.post("/orders", response_model=OrderOut, status_code=201)
def checkout(body: CheckoutIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    items = _cart(db, user)
    if not items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cart is empty")
    # Lock the product rows so two concurrent checkouts cannot oversell stock.
    ids = [i.product_id for i in items]
    products = {p.id: p for p in db.scalars(select(Product).where(Product.id.in_(ids)).with_for_update())}
    order = Order(user_id=user.id, shipping_address=body.shipping_address.strip(), note=body.note,
                  total=Decimal("0"), status="pending")
    total = Decimal("0")
    for item in items:
        p = products.get(item.product_id)
        if p is None or not p.is_active:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Product {item.product_id} unavailable")
        if p.stock < item.quantity:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Insufficient stock for {p.name}")
        p.stock -= item.quantity
        total += p.price * item.quantity
        order.items.append(OrderItem(product_id=p.id, product_name=p.name, price=p.price, quantity=item.quantity))
    order.total = total
    db.add(order)
    for item in items:
        db.delete(item)
    db.commit()
    return db.scalar(select(Order).options(selectinload(Order.items)).where(Order.id == order.id))


@router.get("/orders", response_model=list[OrderOut])
def my_orders(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.scalars(select(Order).options(selectinload(Order.items))
                      .where(Order.user_id == user.id).order_by(Order.created_at.desc())).all()


@router.get("/orders/{order_id}", response_model=OrderOut)
def my_order(order_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    order = db.scalar(select(Order).options(selectinload(Order.items)).where(Order.id == order_id))
    if order is None or order.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    return order


@router.post("/orders/{order_id}/cancel", response_model=OrderOut)
def cancel_order(order_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    order = db.scalar(select(Order).options(selectinload(Order.items)).where(Order.id == order_id))
    if order is None or order.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    if order.status != "pending":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only pending orders can be cancelled")
    for it in order.items:
        if it.product_id and (p := db.get(Product, it.product_id)):
            p.stock += it.quantity
    order.status = "cancelled"
    db.commit()
    return order


@router.get("/profile", response_model=UserOut)
def get_profile(user: User = Depends(get_current_user)):
    return user


@router.patch("/profile", response_model=UserOut)
def update_profile(body: ProfileUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    return user


@router.post("/profile/password", status_code=204)
def change_password(body: PasswordChange, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not verify_password(body.old_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Old password is incorrect")
    user.password_hash = hash_password(body.new_password)
    db.commit()
