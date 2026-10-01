import json
import threading
import time
from pathlib import Path

import pytest

from collector.parser import is_trivial, parse_line, parse_parameters
from collector.service import CollectorService
from collector.tailer import follow

MODEL = Path(__file__).resolve().parents[2] / "ml/artifacts/model.joblib"

TAG = "/* app:uid=2;sid=dd98;rid=abc123;ip=127.0.0.1;ep=GET/api/products */ "


def record(message: str, detail: str | None = None) -> str:
    rec = {"timestamp": "2026-10-01 14:35:08.288 UTC", "user": "shop", "error_severity": "LOG", "message": message}
    if detail is not None:
        rec["detail"] = detail
    return json.dumps(rec)


def test_parse_extended_protocol_with_parameters():
    line = record(f"execute <unnamed>: {TAG}SELECT * FROM products WHERE name ILIKE $1 LIMIT $2",
                  "parameters: $1 = 'kaos'' UNION SELECT password_hash FROM users--', $2 = '12'")
    ev = parse_line(line)
    assert ev.user_id == 2 and ev.session_id == "dd98" and ev.request_id == "abc123"
    assert ev.endpoint == "GET /api/products" and ev.ip == "127.0.0.1"
    assert ev.values == ["kaos' UNION SELECT password_hash FROM users--"]  # '12' is trivial
    assert ev.timestamp.year == 2026 and ev.timestamp.tzinfo is not None


def test_parse_simple_protocol_literals():
    ev = parse_line(record(f"statement: {TAG}SELECT 1 FROM t WHERE a = 'O''Neil' AND b = 'x'"))
    assert ev.values == ["O'Neil", "x"]


def test_anonymous_tag():
    tag = "/* app:uid=-;sid=-;rid=r1;ip=10.0.0.5;ep=POST/api/auth/login */ "
    ev = parse_line(record(f"execute <unnamed>: {tag}SELECT * FROM users WHERE email = $1",
                           "parameters: $1 = 'admin'' or ''1''=''1'"))
    assert ev.user_id is None and ev.session_id is None and ev.values == ["admin' or '1'='1"]


def test_untagged_and_non_json_lines_ignored():
    assert parse_line(record("execute <unnamed>: SELECT 1", "parameters: $1 = 'x'")) is None
    assert parse_line("not json /* app:uid=1 */") is None
    assert parse_line(record("connection authorized: user=shop")) is None


def test_parameter_value_containing_separator_text():
    params = parse_parameters("parameters: $1 = 'a'', $2 = ''b', $2 = NULL, $3 = 'c'")
    assert params == ["a', $2 = 'b", "c"]


@pytest.mark.parametrize("v", ["12", "-3.5", "t", "false", "2026-10-01 14:00:00+00",
                               "$argon2id$v=19$m=65536,t=3,p=4$abc", "pending", ""])
def test_trivial_values(v):
    assert is_trivial(v)


@pytest.mark.parametrize("v", ["kaos polos", "' or 1=1--", "Jl. Sudirman 5"])
def test_non_trivial_values(v):
    assert not is_trivial(v)


class FakeStore:
    def __init__(self):
        self.rows = []

    def save(self, row):
        self.rows.append(row)
        return len(self.rows)


@pytest.fixture(scope="module")
def detector():
    if not MODEL.exists():
        pytest.skip("model artifact not trained yet")
    from detector.model import SQLiDetector
    return SQLiDetector.load(MODEL)


def test_service_classifies_and_dedupes(detector):
    store = FakeStore()
    svc = CollectorService(detector, store, ignored_endpoints=["/api/monitor"])
    attack = "kaos'' UNION SELECT password_hash, email FROM users--"
    line = record(f"execute <unnamed>: {TAG}SELECT ... $1 ... $2", f"parameters: $1 = '{attack}', $2 = '{attack}'")
    svc.handle(parse_line(line))
    svc.handle(parse_line(line))  # same request id -> deduplicated
    assert len(store.rows) == 1
    assert store.rows[0]["label"] == "SQLi" and store.rows[0]["user_id"] == 2

    normal = record(f"execute <unnamed>: {TAG.replace('abc123', 'r2')}SELECT ... $1", "parameters: $1 = 'kaos polos hitam'")
    svc.handle(parse_line(normal))
    assert store.rows[-1]["label"] == "Normal"


def test_service_attempted_username_and_ignored_endpoint(detector):
    store = FakeStore()
    svc = CollectorService(detector, store, ignored_endpoints=["/api/monitor"])
    tag = "/* app:uid=-;sid=-;rid=r9;ip=10.0.0.5;ep=POST/api/auth/login */ "
    svc.handle(parse_line(record(f"execute <unnamed>: {tag}SELECT * FROM users WHERE email = $1",
                                 "parameters: $1 = 'admin'' or ''1''=''1''--'")))
    assert store.rows[0]["attempted_username"] == "admin' or '1'='1'--" and store.rows[0]["label"] == "SQLi"
    mon = "/* app:uid=1;sid=s;rid=r10;ip=1.1.1.1;ep=GET/api/monitor/logs */ "
    svc.handle(parse_line(record(f"execute <unnamed>: {mon}SELECT ... $1", "parameters: $1 = 'budi'")))
    assert len(store.rows) == 1


def test_follow_reads_appended_lines_and_survives_truncation(tmp_path):
    path = tmp_path / "pg.json"
    path.write_text("old line\n")
    got, stop = [], threading.Event()

    def reader():
        for line in follow(path, poll_interval=0.01, stop=stop.is_set):
            got.append(line.strip())

    t = threading.Thread(target=reader, daemon=True)
    t.start()
    time.sleep(0.1)
    with path.open("a") as f:
        f.write("first\nsec")
        f.flush()
        time.sleep(0.05)
        f.write("ond\n")
    time.sleep(0.1)
    path.write_text("after-truncate\n")
    time.sleep(0.2)
    stop.set()
    t.join(1)
    assert got == ["first", "second", "after-truncate"]
