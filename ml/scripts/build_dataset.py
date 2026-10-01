"""Merge sources -> normalize -> deduplicate -> stratified train/test split, plus an EDA summary.

Deduplication is done on the *normalized* text and BEFORE splitting. Otherwise
'1 OR 1=1' and '1%20or%201=1' could land in train and test respectively and the
test score would be inflated (data leakage).
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split

from detector.preprocessing import normalize

ML = Path(__file__).resolve().parents[1]
RAW, OUT, REPORTS = ML / "data/raw", ML / "data/processed", ML / "reports"
SEED = 42


def read_lines(path: Path) -> list[str]:
    lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    return [ln for ln in (x.strip() for x in lines) if ln]


def load_sources() -> pd.DataFrame:
    frames = []

    hp = pd.read_csv(RAW / "httpparams_payload_full.csv", keep_default_na=False)
    # XSS / command injection / path traversal are out of scope -> dropped, not relabeled as normal.
    hp = hp[hp.attack_type.isin(["norm", "sqli"])]
    frames.append(pd.DataFrame({
        "payload": hp.payload.astype(str),
        "label": (hp.attack_type == "sqli").astype(int),
        "source": "httpparams_" + hp.attack_type,
    }))

    for f in sorted(RAW.glob("pallt_*.txt")) + sorted(RAW.glob("fuzzdb_*.txt")):
        payloads = read_lines(f)
        frames.append(pd.DataFrame({"payload": payloads, "label": 1, "source": f.stem}))

    syn = pd.read_csv(RAW / "ecommerce_normal.csv", keep_default_na=False)
    frames.append(pd.DataFrame({"payload": syn.payload, "label": 0, "source": syn.source}))
    return pd.concat(frames, ignore_index=True)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    REPORTS.mkdir(parents=True, exist_ok=True)

    df = load_sources()
    stats = {"raw_rows": len(df), "raw_by_label": df.label.value_counts().to_dict()}

    df["normalized"] = df.payload.map(normalize)
    df = df[df.normalized.str.len() > 0]

    # Same normalized text with both labels = ambiguous, cannot be learned -> drop all copies.
    label_counts = df.groupby("normalized").label.nunique()
    conflicts = label_counts[label_counts > 1].index
    stats["conflicting_texts_dropped"] = int(len(conflicts))
    df = df[~df.normalized.isin(conflicts)]

    before = len(df)
    df = df.drop_duplicates("normalized").reset_index(drop=True)
    stats["duplicates_removed"] = before - len(df)
    stats["final_rows"] = len(df)
    stats["final_by_label"] = {int(k): int(v) for k, v in df.label.value_counts().items()}
    stats["sqli_ratio"] = round(float(df.label.mean()), 4)
    stats["by_source"] = df.source.value_counts().to_dict()
    stats["length_by_label"] = {
        int(k): {"mean": round(float(v.mean()), 1), "median": float(v.median()), "max": int(v.max())}
        for k, v in df.groupby("label").normalized.apply(lambda s: s.str.len())
        .groupby(level=0)
    }

    train, test = train_test_split(df, test_size=0.2, stratify=df.label, random_state=SEED)
    train.to_csv(OUT / "train.csv", index=False)
    test.to_csv(OUT / "test.csv", index=False)
    stats["train_rows"], stats["test_rows"] = len(train), len(test)

    (REPORTS / "dataset_stats.json").write_text(json.dumps(stats, indent=2))
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
