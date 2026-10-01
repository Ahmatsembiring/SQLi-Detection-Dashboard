# CLAUDE.md

Thesis project: real-time SQLi detection (char n-gram TF-IDF + Random Forest) on PostgreSQL query logs of an e-commerce app. Owner is an Indonesian undergraduate — communicate in Indonesian, keep code/comments in English, act as a mentor (explain the *why* briefly).

## Hard rules
- Main app (`backend/`) uses SQLAlchemy ORM / bound parameters only. Never string-built SQL there.
- Intentionally vulnerable code lives only in `lab/target/` on the internal Docker network `labnet`. Never publish its ports or reuse it elsewhere.
- Scope is detection + logging, not a WAF. No blocking/bypass features unless asked.
- ML: dedupe on normalized text before splitting; report FPR; never tune on `ml/data/lab/` (held-out).

## Decisions already made
- Analyzed data = bound parameter values from PostgreSQL `jsonlog` (`detail: parameters: $1 = '...'`).
- Actor tagging = SQL comment `/* app:uid=;sid=;rid=;ip=;ep= */` added in `backend/app/db.py` from the `ContextVar` in `request_context.py`.
- Collector DB role `detector` has `log_statement='none'` (avoids feedback loop) and least-privilege grants (migration `0001`).
- Real-time = `NOTIFY attack_events` → backend `LISTEN` → WebSocket `/ws/monitor`.

## Commands
- Stack: `docker compose up -d --build` (frontend :8080, backend :8000, db 127.0.0.1:5432 — use `127.0.0.1`, not `localhost`, from Windows).
- Tests: `.venv/Scripts/python -m pytest ml/tests collector/tests` and `cd backend && ../.venv/Scripts/python -m pytest tests`.
- Retrain: `ml/scripts/build_dataset.py` → `ml/scripts/train.py`; keep `collector/requirements.txt` sklearn version equal to training.
- Shell files must stay LF (`.gitattributes`); in Git Bash use `MSYS_NO_PATHCONV=1` for `docker compose exec` paths.
