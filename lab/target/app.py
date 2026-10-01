"""INTENTIONALLY VULNERABLE target -- LAB ONLY, never deploy.

Runs only on the internal Docker network of lab/docker-compose.yml (no published ports,
no internet). Its single purpose is to let sqlmap generate realistic SQL injection
payloads; every received parameter value is captured to /output/received.jsonl.
"""
import json
import os
import sqlite3
import threading
import time

from flask import Flask, request

app = Flask(__name__)
DB = "/tmp/lab.db"
OUT = os.getenv("CAPTURE_FILE", "/output/received.jsonl")
_lock = threading.Lock()


def init_db():
    con = sqlite3.connect(DB)
    con.executescript("""
        DROP TABLE IF EXISTS products; DROP TABLE IF EXISTS users;
        CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price INTEGER);
        CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, password TEXT);
        INSERT INTO products (name, price) VALUES ('kaos polos', 59000), ('kopi lampung', 55000), ('kemeja flanel', 149000);
        INSERT INTO users (email, password) VALUES ('admin@lab.local', 'secret');
    """)
    con.commit()
    con.close()


@app.before_request
def capture():
    values = {**request.args.to_dict(), **request.form.to_dict()}
    with _lock, open(OUT, "a", encoding="utf-8") as f:
        for k, v in values.items():
            f.write(json.dumps({"ts": time.time(), "path": request.path, "param": k, "value": v,
                                "agent": request.headers.get("User-Agent", "")}) + "\n")


def run(sql):
    con = sqlite3.connect(DB)
    try:
        return con.execute(sql).fetchall()  # string-built SQL: vulnerable on purpose
    except sqlite3.Error as e:
        return [("error", str(e))]
    finally:
        con.close()


@app.get("/search")
def search():
    q = request.args.get("q", "")
    return {"rows": run(f"SELECT id, name, price FROM products WHERE name LIKE '%{q}%'")}


@app.get("/product")
def product():
    return {"rows": run(f"SELECT id, name, price FROM products WHERE id = {request.args.get('id', '1')}")}


@app.post("/login")
def login():
    rows = run(f"SELECT id FROM users WHERE email = '{request.form.get('email', '')}' "
               f"AND password = '{request.form.get('password', '')}'")
    return {"ok": bool(rows and rows[0][0] != "error")}


@app.get("/review")
def review():
    c = request.args.get("comment", "")
    return {"rows": run(f"SELECT '{c}' AS echoed")}


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, threaded=True)
