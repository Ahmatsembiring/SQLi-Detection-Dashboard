"""Log collector + real-time detector service (FR-11, FR-13..FR-19).

    PostgreSQL jsonlog --tail--> parse tag + bound values --> normalize --> n-gram --> Random Forest
        --> attack_logs (+ NOTIFY) --> backend WebSocket --> admin dashboard
"""
from __future__ import annotations

import logging
import os
import signal
import time
from collections import OrderedDict
from pathlib import Path

from detector.model import SQLiDetector

from .parser import LogEvent, parse_line
from .store import Store
from .tailer import follow

log = logging.getLogger("collector")

# The admin dashboard's own polling queries are not user-facing input points.
DEFAULT_IGNORED = "/api/monitor,/ws/"
LOGIN_ENDPOINTS = ("/api/auth/login", "/api/auth/register")


class SeenCache:
    """Remember (request_id, value) pairs so a value bound several times in one request
    (e.g. COUNT query + page query) is classified and stored once."""

    def __init__(self, size: int = 5000):
        self.size = size
        self._data: OrderedDict[tuple, None] = OrderedDict()

    def check_and_add(self, key: tuple) -> bool:
        if key in self._data:
            return True
        self._data[key] = None
        if len(self._data) > self.size:
            self._data.popitem(last=False)
        return False


class CollectorService:
    def __init__(self, detector: SQLiDetector, store: Store, store_normal: bool = True,
                 ignored_endpoints: list[str] | None = None):
        self.detector = detector
        self.store = store
        self.store_normal = store_normal
        self.ignored = ignored_endpoints or []
        self.seen = SeenCache()
        self.stats = {"events": 0, "values": 0, "sqli": 0}

    def handle(self, event: LogEvent) -> list[dict]:
        if event.endpoint and any(p in event.endpoint for p in self.ignored):
            return []
        self.stats["events"] += 1
        results = []
        for value in event.values:
            if self.seen.check_and_add((event.request_id, value)):
                continue
            pred = self.detector.predict(value)
            self.stats["values"] += 1
            if pred.is_sqli:
                self.stats["sqli"] += 1
                log.warning("SQLi p=%.3f uid=%s ip=%s ep=%s payload=%r", pred.probability, event.user_id,
                            event.ip, event.endpoint, value[:200])
            if not pred.is_sqli and not self.store_normal:
                continue
            anonymous_login = event.user_id is None and event.endpoint and event.endpoint.endswith(LOGIN_ENDPOINTS)
            row = {
                "timestamp": event.timestamp,
                "user_id": event.user_id,
                # FR-12: no user_id yet on login/register -> keep what was typed as the identity hint.
                "attempted_username": event.values[0][:255] if anonymous_login and event.values else None,
                "session_id": event.session_id,
                "ip": event.ip,
                "endpoint": event.endpoint,
                "raw_payload": value,
                "normalized_payload": pred.normalized,
                "query_text": event.statement[:4000],
                "label": pred.label,
                "probability": round(pred.probability, 4),
                "severity": pred.severity,
                "latency_ms": round(pred.latency_ms, 3),
            }
            row["id"] = self.store.save(row)
            results.append(row)
        return results

    def run(self, log_path: Path, from_start: bool = False) -> None:
        stopping = {"flag": False}
        signal.signal(signal.SIGTERM, lambda *_: stopping.update(flag=True))
        last_report = time.monotonic()
        log.info("tailing %s", log_path)
        for line in follow(log_path, from_start=from_start, stop=lambda: stopping["flag"]):
            event = parse_line(line)
            if event is not None and event.values:
                try:
                    self.handle(event)
                except Exception:
                    log.exception("failed to handle event")
            if time.monotonic() - last_report > 60:
                log.info("stats %s", self.stats)
                last_report = time.monotonic()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    log_dir = Path(os.getenv("LOG_DIR", "/var/log/postgresql"))
    log_file = log_dir / os.getenv("LOG_FILE", "postgresql.json")
    model_path = os.getenv("MODEL_PATH", "/app/model/model.joblib")

    detector = SQLiDetector.load(model_path)
    threshold = os.getenv("THRESHOLD")
    if threshold:
        detector.threshold = float(threshold)
    detector.predict("warm up")
    log.info("model loaded: %s (threshold %.2f)", detector.metadata.get("features"), detector.threshold)

    store = Store(os.environ["DETECTOR_DB_URL"], os.getenv("NOTIFY_CHANNEL", "attack_events"))
    store.connect()
    ignored = [p for p in os.getenv("IGNORED_ENDPOINTS", DEFAULT_IGNORED).split(",") if p]
    service = CollectorService(detector, store, store_normal=os.getenv("STORE_NORMAL", "true") == "true",
                               ignored_endpoints=ignored)
    service.run(log_file, from_start=os.getenv("FROM_START", "false") == "true")


if __name__ == "__main__":
    main()
