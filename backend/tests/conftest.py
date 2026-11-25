import os
import tempfile

# Must be set before the app (and its engine) is imported.
_db_file = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_db_file}"
os.environ["JWT_SECRET"] = "test-secret-that-is-at-least-32-bytes-long"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import event  # noqa: E402

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Category, Product, User  # noqa: E402
from app.security import auth_rate_limiter, hash_password  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db():
    auth_rate_limiter.reset()
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        db.add_all([
            User(name="Admin", email="admin@test.id", role="admin", password_hash=hash_password("Admin12345!")),
            User(name="Budi", email="budi@test.id", role="user", password_hash=hash_password("Password123!")),
        ])
        cat = Category(name="Fashion")
        db.add(cat)
        db.flush()
        db.add_all([
            Product(name="Kaos Polos Hitam", price=59000, stock=10, category_id=cat.id),
            Product(name="Kemeja Flanel", price=149000, stock=2, category_id=cat.id),
        ])
        db.commit()
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def login(client, email, password):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def user_headers(client):
    return login(client, "budi@test.id", "Password123!")


@pytest.fixture
def admin_headers(client):
    return login(client, "admin@test.id", "Admin12345!")


@pytest.fixture
def captured_sql():
    """Collect every SQL statement actually sent to the DB (after the tagging hook)."""
    statements = []

    def _capture(conn, cursor, statement, parameters, context, executemany):
        statements.append((statement, parameters))

    event.listen(engine, "before_cursor_execute", _capture)
    yield statements
    event.remove(engine, "before_cursor_execute", _capture)
