"""Admin monitoring API: detection log, charts, risk profiles, false-positive marking, export
and the live WebSocket feed (FR-17 .. FR-25). Admin only (NFR-07)."""
from __future__ import annotations

import csv
import io
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from fastapi.responses import StreamingResponse
from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session, joinedload

from ..db import SessionLocal, get_db
from ..deps import require_admin
from ..models import AttackLog, User
from ..realtime import manager
from ..schemas import AttackLogOut, AttackLogPage, FalsePositiveIn
from ..security import decode_token

router = APIRouter(prefix="/api/monitor", tags=["monitoring"], dependencies=[Depends(require_admin)])
ws_router = APIRouter()


def _to_out(log: AttackLog) -> AttackLogOut:
    out = AttackLogOut.model_validate(log)
    out.username = log.user.name if log.user else None
    return out


def _filtered(
    date_from: datetime | None, date_to: datetime | None, user_id: int | None, user: str | None,
    label: str | None, ip: str | None, include_fp: bool,
) -> Select:
    stmt = select(AttackLog).options(joinedload(AttackLog.user))
    if date_from:
        stmt = stmt.where(AttackLog.timestamp >= date_from)
    if date_to:
        stmt = stmt.where(AttackLog.timestamp <= date_to)
    if user_id is not None:
        stmt = stmt.where(AttackLog.user_id == user_id)
    if user:
        stmt = stmt.outerjoin(User, User.id == AttackLog.user_id).where(
            or_(User.name.icontains(user), User.email.icontains(user), AttackLog.attempted_username.icontains(user)))
    if label:
        stmt = stmt.where(AttackLog.label == label)
    if ip:
        stmt = stmt.where(AttackLog.ip == ip)
    if not include_fp:
        stmt = stmt.where(AttackLog.is_false_positive.is_(False))
    return stmt


class LogFilters:
    def __init__(
        self,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        user_id: int | None = None,
        user: str | None = Query(None, max_length=100),
        label: str | None = Query(None, pattern="^(Normal|SQLi)$"),
        ip: str | None = Query(None, max_length=45),
        include_fp: bool = True,
    ):
        self.args = (date_from, date_to, user_id, user, label, ip, include_fp)

    def stmt(self) -> Select:
        return _filtered(*self.args)


@router.get("/logs", response_model=AttackLogPage)
def list_logs(f: LogFilters = Depends(), page: int = Query(1, ge=1), size: int = Query(25, ge=1, le=200),
              db: Session = Depends(get_db)):
    stmt = f.stmt()
    total = db.scalar(select(func.count()).select_from(stmt.with_only_columns(AttackLog.id).subquery()))
    rows = db.scalars(stmt.order_by(AttackLog.timestamp.desc(), AttackLog.id.desc())
                      .offset((page - 1) * size).limit(size)).all()
    return AttackLogPage(items=[_to_out(r) for r in rows], total=total or 0, page=page, size=size)


@router.get("/logs/{log_id}", response_model=AttackLogOut)
def get_log(log_id: int, db: Session = Depends(get_db)):
    log = db.scalar(select(AttackLog).options(joinedload(AttackLog.user)).where(AttackLog.id == log_id))
    if log is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Log not found")
    return _to_out(log)


@router.patch("/logs/{log_id}/false-positive", response_model=AttackLogOut)
def mark_false_positive(log_id: int, body: FalsePositiveIn, db: Session = Depends(get_db),
                        admin: User = Depends(require_admin)):
    """FR-24 + feedback loop: flagged rows can be exported later as relabeled training data."""
    log = db.scalar(select(AttackLog).options(joinedload(AttackLog.user)).where(AttackLog.id == log_id))
    if log is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Log not found")
    log.is_false_positive = body.is_false_positive
    log.reviewed_by = admin.id
    db.commit()
    return _to_out(log)


def _percentile(values: list[float], q: float) -> float | None:
    if not values:
        return None
    values = sorted(values)
    idx = min(len(values) - 1, max(0, round(q / 100 * (len(values) - 1))))
    return round(values[idx], 3)


@router.get("/stats")
def stats(hours: int = Query(24, ge=1, le=24 * 30), db: Session = Depends(get_db)):
    """Aggregates for the dashboard charts (FR-21). Bucketing is done in Python to stay
    database-agnostic; the window is bounded so the row count stays small."""
    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=hours)
    rows = db.execute(select(AttackLog.timestamp, AttackLog.label, AttackLog.is_false_positive,
                             AttackLog.latency_ms, AttackLog.pipeline_delay_ms)
                      .where(AttackLog.timestamp >= since)).all()

    bucket = timedelta(minutes=5) if hours <= 2 else timedelta(hours=1) if hours <= 72 else timedelta(days=1)
    step = int(bucket.total_seconds())
    series: dict[int, Counter] = defaultdict(Counter)
    ratio = Counter()
    lat, delay = [], []
    for ts, label, fp, l_ms, d_ms in rows:
        ts = ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
        effective = "Normal" if fp else label
        series[int(ts.timestamp()) // step * step][effective] += 1
        ratio[effective] += 1
        lat.append(l_ms)
        if d_ms is not None:
            delay.append(d_ms)

    start = int(since.timestamp()) // step * step
    timeline = [{"t": datetime.fromtimestamp(t, timezone.utc).isoformat(),
                 "SQLi": series[t]["SQLi"], "Normal": series[t]["Normal"]}
                for t in range(start, int(now.timestamp()) + 1, step)]

    offenders = db.execute(
        select(AttackLog.user_id, User.name, User.email, AttackLog.attempted_username, AttackLog.ip,
               func.count(AttackLog.id).label("attempts"), func.max(AttackLog.timestamp).label("last_seen"))
        .outerjoin(User, User.id == AttackLog.user_id)
        .where(AttackLog.label == "SQLi", AttackLog.is_false_positive.is_(False), AttackLog.timestamp >= since)
        .group_by(AttackLog.user_id, User.name, User.email, AttackLog.attempted_username, AttackLog.ip)
        .order_by(func.count(AttackLog.id).desc()).limit(10)).all()

    return {
        "window_hours": hours,
        "bucket_seconds": step,
        "timeline": timeline,
        "ratio": {"Normal": ratio["Normal"], "SQLi": ratio["SQLi"]},
        "total": len(rows),
        "top_offenders": [
            {"user_id": o.user_id, "name": o.name or "anonymous", "email": o.email,
             "attempted_username": o.attempted_username, "ip": o.ip, "attempts": o.attempts,
             "last_seen": o.last_seen.isoformat() if o.last_seen else None} for o in offenders],
        "latency_ms": {"mean": round(sum(lat) / len(lat), 3) if lat else None, "p95": _percentile(lat, 95)},
        "pipeline_delay_ms": {"mean": round(sum(delay) / len(delay), 3) if delay else None,
                              "p95": _percentile(delay, 95)},
        "live_clients": manager.count,
    }


def _risk_level(attempts: int, avg_score: float) -> str:
    if attempts >= 10 or (attempts >= 3 and avg_score >= 0.9):
        return "High"
    if attempts >= 3:
        return "Medium"
    return "Low" if attempts else "None"


@router.get("/risk")
def risk_profiles(db: Session = Depends(get_db)):
    """FR-23: per-user risk profile from confirmed (not false-positive) SQLi detections."""
    sqli = (AttackLog.label == "SQLi") & AttackLog.is_false_positive.is_(False)
    rows = db.execute(
        select(User.id, User.name, User.email, User.status,
               func.count(AttackLog.id).label("inputs"),
               func.count(AttackLog.id).filter(sqli).label("attempts"),
               func.avg(AttackLog.probability).filter(sqli).label("avg_score"),
               func.max(AttackLog.probability).filter(sqli).label("max_score"),
               func.max(AttackLog.timestamp).filter(sqli).label("last_attempt"))
        .outerjoin(AttackLog, AttackLog.user_id == User.id)
        .group_by(User.id, User.name, User.email, User.status)).all()
    out = []
    for r in rows:
        avg = float(r.avg_score or 0)
        out.append({"user_id": r.id, "name": r.name, "email": r.email, "status": r.status,
                    "monitored_inputs": r.inputs, "attempts": r.attempts, "avg_score": round(avg, 4),
                    "max_score": round(float(r.max_score or 0), 4),
                    "last_attempt": r.last_attempt.isoformat() if r.last_attempt else None,
                    "risk": _risk_level(r.attempts, avg)})
    return sorted(out, key=lambda x: (x["attempts"], x["avg_score"]), reverse=True)


EXPORT_COLUMNS = ["id", "timestamp", "username", "attempted_username", "ip", "endpoint", "label",
                  "probability", "severity", "latency_ms", "pipeline_delay_ms", "is_false_positive", "raw_payload"]
EXPORT_LIMIT = 50000


def _export_rows(db: Session, f: LogFilters) -> list[AttackLogOut]:
    rows = db.scalars(f.stmt().order_by(AttackLog.timestamp.desc()).limit(EXPORT_LIMIT)).all()
    return [_to_out(r) for r in rows]


def _csv_safe(value) -> str:
    """Prevent CSV/formula injection when the export is opened in Excel (payloads are attacker-controlled)."""
    s = "" if value is None else str(value)
    return "'" + s if s[:1] in ("=", "+", "-", "@", "\t", "\r") else s


@router.get("/export.csv")
def export_csv(f: LogFilters = Depends(), db: Session = Depends(get_db)):
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(EXPORT_COLUMNS)
    for r in _export_rows(db, f):
        d = r.model_dump()
        writer.writerow([_csv_safe(d.get(c)) for c in EXPORT_COLUMNS])
    name = f"sqli-report-{datetime.now():%Y%m%d-%H%M%S}.csv"
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="{name}"'})


@router.get("/export.pdf")
def export_pdf(f: LogFilters = Depends(), db: Session = Depends(get_db)):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    rows = _export_rows(db, f)
    sqli = [r for r in rows if r.label == "SQLi" and not r.is_false_positive]
    styles = getSampleStyleSheet()
    small = styles["BodyText"].clone("small", fontSize=7, leading=8)
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), title="SQL Injection Detection Report")
    lat = [r.latency_ms for r in rows]
    story = [
        Paragraph("SQL Injection Detection Report", styles["Title"]),
        Paragraph(f"Generated {datetime.now():%Y-%m-%d %H:%M:%S}", styles["Normal"]),
        Spacer(1, 8),
        Paragraph(f"Inputs analyzed: <b>{len(rows)}</b> &nbsp; SQLi detected: <b>{len(sqli)}</b> &nbsp; "
                  f"False positives marked: <b>{sum(r.is_false_positive for r in rows)}</b> &nbsp; "
                  f"Mean latency: <b>{(sum(lat) / len(lat)) if lat else 0:.2f} ms</b>", styles["Normal"]),
        Spacer(1, 10),
    ]

    def esc(s) -> str:
        return (str(s) if s is not None else "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    data = [["Time", "User", "IP", "Endpoint", "Prob.", "Severity", "Payload"]]
    for r in sqli[:500]:
        data.append([r.timestamp.strftime("%Y-%m-%d %H:%M:%S"), esc(r.username or r.attempted_username or "anonymous"),
                     esc(r.ip), Paragraph(esc(r.endpoint), small), f"{r.probability:.2f}", r.severity,
                     Paragraph(esc(r.raw_payload[:300]), small)])
    table = Table(data, colWidths=[90, 90, 70, 110, 40, 50, 340], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(table)
    doc.build(story)
    name = f"sqli-report-{datetime.now():%Y%m%d-%H%M%S}.pdf"
    return StreamingResponse(iter([buf.getvalue()]), media_type="application/pdf",
                             headers={"Content-Disposition": f'attachment; filename="{name}"'})


@router.get("/security-posture")
def security_posture():
    """OWASP Top 10 security controls summary for the admin monitoring dashboard."""
    from ..config import get_settings

    s = get_settings()
    return {
        "standard": "OWASP Top 10:2021 / ASVS",
        "controls": [
            {
                "id": "A01",
                "name": "Broken Access Control",
                "status": "active",
                "detail": "RBAC (admin/user), per-resource ownership checks, least-privilege DB roles (shop vs detector).",
            },
            {
                "id": "A02",
                "name": "Cryptographic Failures",
                "status": "active",
                "detail": "Argon2id password hashing + constant-time dummy verification to prevent account enumeration.",
            },
            {
                "id": "A03",
                "name": "Injection",
                "status": "active",
                "detail": "100% SQLAlchemy ORM bound parameters, strict Pydantic schema validation, safe URL & CSV escaping.",
            },
            {
                "id": "A05",
                "name": "Security Misconfiguration",
                "status": "active",
                "detail": "CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer/Permissions-Policy, non-root Docker.",
            },
            {
                "id": "A07",
                "name": "Auth & Session Failures",
                "status": "active",
                "detail": f"Auth rate limit ({s.auth_rate_limit_max} req/{s.auth_rate_limit_window_seconds}s), strong password policy, JWT iss/jti/exp.",
            },
            {
                "id": "A09",
                "name": "Security Logging & Monitoring",
                "status": "active",
                "detail": "PostgreSQL jsonlog -> Char N-Gram TF-IDF + Random Forest -> real-time WebSocket alert & actor tagging.",
            },
        ],
    }


@router.get("/false-positives.csv")
def export_false_positives(db: Session = Depends(get_db)):
    """Feedback data for retraining: payloads an admin confirmed as benign (label 0)."""
    rows = db.scalars(select(AttackLog.raw_payload).where(AttackLog.is_false_positive.is_(True))).all()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["payload", "label"])
    for p in rows:
        writer.writerow([p, 0])
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": 'attachment; filename="false_positives.csv"'})


@ws_router.websocket("/ws/monitor")
async def monitor_socket(ws: WebSocket, token: str = Query(...)):
    """Browsers cannot set an Authorization header on WebSockets, so the JWT is passed as a query param."""
    try:
        payload = decode_token(token)
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        await ws.close(code=4401)
        return
    with SessionLocal() as db:
        user = db.get(User, user_id)
        allowed = user is not None and user.role == "admin" and user.status == "active"
    if not allowed:
        await ws.close(code=4403)
        return
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()  # keep-alive pings from the client
    except WebSocketDisconnect:
        manager.disconnect(ws)
