from app.request_context import RequestActor

INJECTION = "kaos' UNION SELECT password_hash FROM users--"


def test_register_login_me(client):
    r = client.post("/api/auth/register", json={"name": "Siti", "email": "siti@test.id", "password": "Rahasia123"})
    assert r.status_code == 201
    token = r.json()["access_token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["email"] == "siti@test.id" and me.json()["role"] == "user"


def test_password_is_hashed_with_argon2(client):
    from app.db import SessionLocal
    from app.models import User
    from sqlalchemy import select
    with SessionLocal() as db:
        h = db.scalar(select(User.password_hash).where(User.email == "budi@test.id"))
    assert h.startswith("$argon2") and "Password123!" not in h


def test_wrong_password_rejected(client):
    r = client.post("/api/auth/login", json={"email": "budi@test.id", "password": "salah"})
    assert r.status_code == 401


def test_login_injection_does_not_bypass_auth(client):
    r = client.post("/api/auth/login", json={"email": "admin@test.id' OR '1'='1", "password": "x"})
    assert r.status_code == 401


def test_search_injection_is_treated_as_text(client):
    r = client.get("/api/products", params={"q": INJECTION})
    assert r.status_code == 200 and r.json()["total"] == 0
    assert client.get("/api/products", params={"q": "kaos"}).json()["total"] == 1


def test_queries_are_tagged_and_values_are_bound(client, user_headers, captured_sql):
    client.get("/api/products", params={"q": INJECTION}, headers=user_headers)
    tagged = [s for s, _ in captured_sql if s.startswith("/* app:uid=2;")]
    assert tagged, captured_sql
    # The payload must never appear inside the SQL text itself, only as a parameter.
    assert all(INJECTION not in s for s, _ in captured_sql)
    assert any(INJECTION in str(p) for _, p in captured_sql)
    assert "ep=GET/api/products" in tagged[0]


def test_sql_tag_cannot_break_out_of_comment():
    actor = RequestActor(user_id=1, session_id="abc*/;DROP", ip="not-an-ip",
                         endpoint="GET /api/x*/ DROP TABLE users; --%s")
    tag = actor.sql_tag()
    assert tag.count("*/") == 1 and tag.rstrip().endswith("*/")
    assert "%" not in tag and "ip=-" in tag


def test_rbac_user_cannot_access_admin_or_monitor(client, user_headers):
    assert client.get("/api/admin/users", headers=user_headers).status_code == 403
    assert client.get("/api/monitor/logs", headers=user_headers).status_code == 403
    assert client.get("/api/monitor/stats", headers=user_headers).status_code == 403
    assert client.get("/api/monitor/logs").status_code == 401


def test_admin_can_access_monitor(client, admin_headers):
    assert client.get("/api/monitor/logs", headers=admin_headers).json()["total"] == 0
    s = client.get("/api/monitor/stats", headers=admin_headers).json()
    assert s["ratio"] == {"Normal": 0, "SQLi": 0}
    assert client.get("/api/monitor/risk", headers=admin_headers).status_code == 200
    assert client.get("/api/monitor/export.csv", headers=admin_headers).status_code == 200
    assert client.get("/api/monitor/export.pdf", headers=admin_headers).content[:4] == b"%PDF"


def test_cart_checkout_and_stock(client, user_headers):
    client.post("/api/cart", json={"product_id": 2, "quantity": 2}, headers=user_headers)
    r = client.post("/api/orders", json={"shipping_address": "Jl. Sudirman No. 1, Bandar Lampung"},
                    headers=user_headers)
    assert r.status_code == 201 and float(r.json()["total"]) == 298000
    assert client.get("/api/cart", headers=user_headers).json() == []
    assert client.get("/api/products/2").json()["stock"] == 0
    client.post("/api/cart", json={"product_id": 2, "quantity": 1}, headers=user_headers)
    assert client.post("/api/orders", json={"shipping_address": "Jl. Sudirman No. 1"},
                       headers=user_headers).status_code == 400


def test_review_and_profile(client, user_headers):
    r = client.post("/api/products/1/reviews", json={"rating": 5, "comment": "Mantap, Jum'at sampai"},
                    headers=user_headers)
    assert r.status_code == 201
    assert client.get("/api/products/1").json()["review_count"] == 1
    r = client.patch("/api/profile", json={"address": "Jl. Pagar Alam 5"}, headers=user_headers)
    assert r.json()["address"] == "Jl. Pagar Alam 5"


def test_admin_suspend_blocks_user(client, admin_headers, user_headers):
    assert client.patch("/api/admin/users/2/status", json={"status": "suspended"},
                        headers=admin_headers).status_code == 200
    assert client.get("/api/cart", headers=user_headers).status_code == 403
    r = client.post("/api/auth/login", json={"email": "budi@test.id", "password": "Password123!"})
    assert r.status_code == 403


def test_admin_product_crud(client, admin_headers):
    r = client.post("/api/admin/products", json={"name": "Topi", "price": "25000", "stock": 3, "category_id": 1},
                    headers=admin_headers)
    assert r.status_code == 201
    pid = r.json()["id"]
    r = client.put(f"/api/admin/products/{pid}", json={"name": "Topi Baseball", "price": "30000", "stock": 3},
                   headers=admin_headers)
    assert r.json()["name"] == "Topi Baseball"
    assert client.delete(f"/api/admin/products/{pid}", headers=admin_headers).status_code == 204


def test_owasp_security_headers_and_posture(client, admin_headers):
    r = client.get("/api/health")
    assert r.headers.get("x-content-type-options") == "nosniff"
    assert r.headers.get("x-frame-options") == "DENY"
    assert "camera=()" in r.headers.get("permissions-policy", "")

    p = client.get("/api/monitor/security-posture", headers=admin_headers)
    assert p.status_code == 200
    assert p.headers.get("cache-control") == "no-store"
    ids = {c["id"] for c in p.json()["controls"]}
    assert {"A01", "A02", "A03", "A05", "A07", "A09"}.issubset(ids)


def test_owasp_password_policy_and_safe_image_url(client, admin_headers):
    # Weak password (no uppercase / no digit) rejected on register
    r = client.post("/api/auth/register", json={"name": "Lemah", "email": "lemah@test.id", "password": "password"})
    assert r.status_code == 422

    # javascript: URL rejected on product creation
    r = client.post(
        "/api/admin/products",
        json={"name": "Kopi XSS", "price": "50000", "stock": 5, "image_url": "javascript:alert(1)"},
        headers=admin_headers,
    )
    assert r.status_code == 422


def test_owasp_auth_rate_limit(client, monkeypatch):
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "auth_rate_limit_max", 3)
    for _ in range(3):
        r = client.post("/api/auth/login", json={"email": "budi@test.id", "password": "salah"})
        assert r.status_code == 401
    r = client.post("/api/auth/login", json={"email": "budi@test.id", "password": "salah"})
    assert r.status_code == 429 and "retry-after" in r.headers
