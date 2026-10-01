"""Turn lab captures into a labeled held-out test set (validation on attacks NOT used in training).

  SQLi   : parameter values sqlmap sent to the vulnerable lab target (lab/output/received.jsonl)
  Normal : hand-written benign inputs (lab/data/normal_holdout.txt)

sqlmap also sends the original benign value (e.g. 'kaos', '1') and some random
alphanumeric probes; those are not attacks, so only values that differ from the
original AND contain at least one non-alphanumeric character are labeled SQLi.
Any lab sample whose normalized text also occurs in the training data is reported
and excluded, so the test measures generalization only.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pandas as pd

from detector.preprocessing import normalize

ROOT = Path(__file__).resolve().parents[2]
CAPTURE = ROOT / "lab/output/received.jsonl"
NORMAL = ROOT / "lab/data/normal_holdout.txt"
TRAIN = ROOT / "ml/data/processed/train.csv"
OUT = ROOT / "ml/data/lab/lab_test.csv"

ORIGINALS = {"q": "kaos", "id": "1", "email": "a@b.c", "password": "x", "comment": "bagus"}
_HAS_SYMBOL = re.compile(r"[^A-Za-z0-9 ]")


def main() -> None:
    rows = []
    with CAPTURE.open(encoding="utf-8") as f:
        for line in f:
            rec = json.loads(line)
            v, p = rec["value"], rec["param"]
            if p not in ORIGINALS or v == ORIGINALS[p] or not _HAS_SYMBOL.search(v):
                continue
            if p == "password" and v == ORIGINALS["password"]:
                continue
            rows.append({"payload": v, "label": 1, "source": f"lab_sqlmap_{rec['path'].strip('/')}"})

    for line in NORMAL.read_text(encoding="utf-8").splitlines():
        if line.strip() and not line.startswith("#"):
            rows.append({"payload": line.strip(), "label": 0, "source": "lab_normal_handwritten"})

    df = pd.DataFrame(rows)
    df["normalized"] = df.payload.map(normalize)
    df = df[df.normalized.str.len() > 0].drop_duplicates("normalized")

    train_norm = set(pd.read_csv(TRAIN, keep_default_na=False).normalized)
    overlap = df.normalized.isin(train_norm)
    print(f"lab samples: {len(df)}  overlap with training set (removed): {int(overlap.sum())}")
    df = df[~overlap]
    print(df.label.value_counts().rename({0: "Normal", 1: "SQLi"}).to_string())

    OUT.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT, index=False)
    print("saved", OUT)


if __name__ == "__main__":
    main()
