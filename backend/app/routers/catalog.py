from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..deps import get_current_user, get_optional_user
from ..models import Category, Product, Review, User
from ..schemas import CategoryOut, ProductOut, ProductPage, ReviewIn, ReviewOut

router = APIRouter(prefix="/api", tags=["catalog"])

SORTS = {
    "newest": Product.created_at.desc(),
    "price_asc": Product.price.asc(),
    "price_desc": Product.price.desc(),
    "name": Product.name.asc(),
}


def _rating_subquery():
    return (select(Review.product_id, func.avg(Review.rating).label("avg_rating"),
                   func.count(Review.id).label("review_count"))
            .group_by(Review.product_id).subquery())


def _to_out(product: Product, avg, count) -> ProductOut:
    out = ProductOut.model_validate(product)
    out.avg_rating = round(float(avg), 2) if avg is not None else None
    out.review_count = int(count or 0)
    return out


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db), _: User | None = Depends(get_optional_user)):
    return db.scalars(select(Category).order_by(Category.name)).all()


@router.get("/products", response_model=ProductPage)
def list_products(
    q: str | None = Query(None, max_length=200, description="free-text search (monitored input)"),
    category_id: int | None = None,
    sort: str = Query("newest", pattern="^(newest|price_asc|price_desc|name)$"),
    page: int = Query(1, ge=1),
    size: int = Query(12, ge=1, le=60),
    db: Session = Depends(get_db),
    _: User | None = Depends(get_optional_user),
):
    ratings = _rating_subquery()
    stmt = (select(Product, ratings.c.avg_rating, ratings.c.review_count)
            .outerjoin(ratings, ratings.c.product_id == Product.id)
            .options(joinedload(Product.category))
            .where(Product.is_active.is_(True)))
    if q:
        # icontains() binds q as a parameter: ... LIKE '%' || lower($1) || '%'. Never string-formatted.
        stmt = stmt.where(or_(Product.name.icontains(q), Product.description.icontains(q)))
    if category_id is not None:
        stmt = stmt.where(Product.category_id == category_id)

    total = db.scalar(select(func.count()).select_from(stmt.with_only_columns(Product.id).subquery()))
    rows = db.execute(stmt.order_by(SORTS[sort]).offset((page - 1) * size).limit(size)).unique().all()
    return ProductPage(items=[_to_out(p, a, c) for p, a, c in rows], total=total or 0, page=page, size=size)


@router.get("/products/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db), _: User | None = Depends(get_optional_user)):
    ratings = _rating_subquery()
    row = db.execute(select(Product, ratings.c.avg_rating, ratings.c.review_count)
                     .outerjoin(ratings, ratings.c.product_id == Product.id)
                     .options(joinedload(Product.category))
                     .where(Product.id == product_id, Product.is_active.is_(True))).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return _to_out(*row)


@router.get("/products/{product_id}/reviews", response_model=list[ReviewOut])
def list_reviews(product_id: int, db: Session = Depends(get_db), _: User | None = Depends(get_optional_user)):
    rows = db.scalars(select(Review).options(joinedload(Review.user))
                      .where(Review.product_id == product_id).order_by(Review.created_at.desc())).all()
    return [ReviewOut(id=r.id, product_id=r.product_id, user_id=r.user_id, user_name=r.user.name,
                      rating=r.rating, comment=r.comment, created_at=r.created_at) for r in rows]


@router.post("/products/{product_id}/reviews", response_model=ReviewOut, status_code=201)
def create_review(product_id: int, body: ReviewIn, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    if db.get(Product, product_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    review = Review(product_id=product_id, user_id=user.id, rating=body.rating, comment=body.comment.strip())
    db.add(review)
    db.commit()
    return ReviewOut(id=review.id, product_id=product_id, user_id=user.id, user_name=user.name,
                     rating=review.rating, comment=review.comment, created_at=review.created_at)
