"""Store management for admins (FR-07, FR-08)."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from ..db import get_db
from ..deps import require_admin
from ..models import Category, Order, Product, User
from ..schemas import (AdminOrderOut, CategoryIn, CategoryOut, OrderStatusIn, ProductIn, ProductOut, UserOut,
                       UserRoleIn, UserStatusIn)

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


# ---- categories ----------------------------------------------------------------------------
@router.post("/categories", response_model=CategoryOut, status_code=201)
def create_category(body: CategoryIn, db: Session = Depends(get_db)):
    cat = Category(**body.model_dump())
    db.add(cat)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Category already exists")
    return cat


@router.put("/categories/{cat_id}", response_model=CategoryOut)
def update_category(cat_id: int, body: CategoryIn, db: Session = Depends(get_db)):
    cat = db.get(Category, cat_id)
    if cat is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    cat.name, cat.description = body.name, body.description
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Category already exists")
    return cat


@router.delete("/categories/{cat_id}", status_code=204)
def delete_category(cat_id: int, db: Session = Depends(get_db)):
    cat = db.get(Category, cat_id)
    if cat is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    db.delete(cat)
    db.commit()


# ---- products ------------------------------------------------------------------------------
@router.get("/products", response_model=list[ProductOut])
def all_products(q: str | None = Query(None, max_length=200), db: Session = Depends(get_db)):
    stmt = select(Product).options(joinedload(Product.category)).order_by(Product.id.desc())
    if q:
        stmt = stmt.where(Product.name.icontains(q))
    return db.scalars(stmt).all()


@router.post("/products", response_model=ProductOut, status_code=201)
def create_product(body: ProductIn, db: Session = Depends(get_db)):
    product = Product(**body.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product, ["category"])
    return product


@router.put("/products/{product_id}", response_model=ProductOut)
def update_product(product_id: int, body: ProductIn, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    for k, v in body.model_dump().items():
        setattr(product, k, v)
    db.commit()
    db.refresh(product, ["category"])
    return product


@router.delete("/products/{product_id}", status_code=204)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    db.delete(product)
    db.commit()


# ---- orders --------------------------------------------------------------------------------
def _admin_order(o: Order) -> AdminOrderOut:
    out = AdminOrderOut.model_validate(o)
    out.user_name, out.user_email = o.user.name, o.user.email
    return out


@router.get("/orders", response_model=list[AdminOrderOut])
def all_orders(status_filter: str | None = Query(None, alias="status"), db: Session = Depends(get_db)):
    stmt = select(Order).options(selectinload(Order.items), joinedload(Order.user)).order_by(Order.created_at.desc())
    if status_filter:
        stmt = stmt.where(Order.status == status_filter)
    return [_admin_order(o) for o in db.scalars(stmt).unique()]


@router.patch("/orders/{order_id}", response_model=AdminOrderOut)
def set_order_status(order_id: int, body: OrderStatusIn, db: Session = Depends(get_db)):
    order = db.scalar(select(Order).options(selectinload(Order.items), joinedload(Order.user))
                      .where(Order.id == order_id))
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    order.status = body.status
    db.commit()
    return _admin_order(order)


# ---- users ---------------------------------------------------------------------------------
@router.get("/users", response_model=list[UserOut])
def all_users(q: str | None = Query(None, max_length=200), db: Session = Depends(get_db)):
    stmt = select(User).order_by(User.id)
    if q:
        stmt = stmt.where(or_(User.name.icontains(q), User.email.icontains(q)))
    return db.scalars(stmt).all()


@router.patch("/users/{user_id}/status", response_model=UserOut)
def set_user_status(user_id: int, body: UserStatusIn, db: Session = Depends(get_db),
                    admin: User = Depends(require_admin)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if user.id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot suspend yourself")
    user.status = body.status
    db.commit()
    return user


@router.patch("/users/{user_id}/role", response_model=UserOut)
def set_user_role(user_id: int, body: UserRoleIn, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if user.id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot change your own role")
    user.role = body.role
    db.commit()
    return user


@router.get("/summary")
def store_summary(db: Session = Depends(get_db)):
    return {
        "users": db.scalar(select(func.count(User.id))),
        "products": db.scalar(select(func.count(Product.id))),
        "orders": db.scalar(select(func.count(Order.id))),
        "revenue": float(db.scalar(select(func.coalesce(func.sum(Order.total), 0))
                                   .where(Order.status.in_(["paid", "shipped", "completed"])))),
    }
