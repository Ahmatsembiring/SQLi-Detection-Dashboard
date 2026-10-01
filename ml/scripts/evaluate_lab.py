"""Evaluate the deployed model and the baselines on the lab-generated held-out set.

The lab set (ml/data/lab/lab_test.csv) contains sqlmap payloads captured in the isolated
lab and hand-written normal inputs; nothing in it was used for training, and samples whose
normalized text appears in the training set were already removed.
Baselines are re-fitted here on the same train split with the same features as the RF.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC

from detector.features import build_vectorizer
from detector.model import SQLiDetector
from detector.rules import rule_based_predict

from train import measure_latency, test_metrics  # same metric definitions as the main experiment

ML = Path(__file__).resolve().parents[1]


def main() -> None:
    lab = pd.read_csv(ML / "data/lab/lab_test.csv", keep_default_na=False)
    train = pd.read_csv(ML / "data/processed/train.csv", keep_default_na=False)
    detector = SQLiDetector.load(ML / "artifacts/model.joblib")
    feat = detector.metadata["features"]
    vec_args = (feat["analyzer"], tuple(feat["ngram_range"]), feat["weighting"])

    y = lab.label.values
    results = {}

    proba = detector.pipeline.predict_proba(lab.normalized.values)[:, 1]
    results["RandomForest"] = {**test_metrics(y, (proba >= detector.threshold).astype(int), proba),
                               "latency": measure_latency(detector, list(lab.payload.values))}
    lab.assign(proba=proba, pred=(proba >= 0.5).astype(int)).query("pred != label").to_csv(
        ML / "reports/lab_errors_rf.csv", index=False)

    baselines = {
        "MultinomialNB": MultinomialNB(),
        "LogisticRegression": LogisticRegression(max_iter=2000, class_weight="balanced"),
        "LinearSVM": CalibratedClassifierCV(LinearSVC(class_weight="balanced"), cv=3),
    }
    for name, clf in baselines.items():
        pipe = Pipeline([("vec", build_vectorizer(*vec_args)), ("clf", clf)]).fit(train.normalized, train.label)
        p = pipe.predict_proba(lab.normalized.values)[:, 1]
        results[name] = test_metrics(y, (p >= 0.5).astype(int), p)
    results["RuleBased"] = test_metrics(y, np.array([rule_based_predict(v) for v in lab.payload.values]))

    summary = {"n": len(lab), "sqli": int(y.sum()), "normal": int((y == 0).sum()),
               "by_source": lab.source.value_counts().to_dict(), "models": results}
    (ML / "reports/lab_results.json").write_text(json.dumps(summary, indent=2, default=float))
    for name, m in results.items():
        print(f"{name:20s} P={m['precision']:.4f} R={m['recall']:.4f} F1={m['f1']:.4f} FPR={m['fpr']:.4f} "
              f"FP={m['fp']} FN={m['fn']}")


if __name__ == "__main__":
    main()
