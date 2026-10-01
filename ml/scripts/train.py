"""Experiments (methodology chapter) and final model export.

Stage 1  feature screening : {char, word} x n-gram range x {TF-IDF, Count} with a default Random Forest
Stage 2  RF tuning          : n_estimators, max_depth, min_samples_leaf on the best feature set
Stage 3  baselines          : Naive Bayes, Logistic Regression, linear SVM, rule-based (same features)
Stage 4  held-out test      : final metrics, confusion matrix, ROC-AUC, per-query latency -> model.joblib

All CV runs use sklearn Pipelines so the vectorizer is fitted inside each fold (no leakage).
Usage:  python ml/scripts/train.py [--quick]
"""
from __future__ import annotations

import argparse
import json
import time
from itertools import product
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (confusion_matrix, f1_score, make_scorer, precision_score, recall_score,
                             roc_auc_score)
from sklearn.model_selection import StratifiedKFold, cross_validate
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC

from detector.features import build_vectorizer
from detector.model import SQLiDetector
from detector.rules import rule_based_predict

ML = Path(__file__).resolve().parents[1]
DATA, REPORTS, ARTIFACTS = ML / "data/processed", ML / "reports", ML / "artifacts"
SEED = 42


def fpr(y_true, y_pred) -> float:
    tn, fp, _, _ = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    return fp / (fp + tn) if (fp + tn) else 0.0


SCORING = {
    "precision": make_scorer(precision_score, zero_division=0),
    "recall": make_scorer(recall_score),
    "f1": make_scorer(f1_score),
    "fpr": make_scorer(fpr),
}


def rf(**kw) -> RandomForestClassifier:
    params = dict(n_estimators=100, class_weight="balanced", n_jobs=-1, random_state=SEED)
    params.update(kw)
    return RandomForestClassifier(**params)


def cv_eval(pipe: Pipeline, X, y, folds: int) -> dict:
    cv = StratifiedKFold(n_splits=folds, shuffle=True, random_state=SEED)
    res = cross_validate(pipe, X, y, cv=cv, scoring=SCORING, n_jobs=1)
    out = {}
    for m in SCORING:
        out[m] = round(float(res[f"test_{m}"].mean()), 4)
        out[f"{m}_std"] = round(float(res[f"test_{m}"].std()), 4)
    out["fit_time_s"] = round(float(res["fit_time"].mean()), 2)
    return out


def test_metrics(y_true, y_pred, y_score=None) -> dict:
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    m = {
        "accuracy": round((tp + tn) / len(y_true), 4),
        "precision": round(precision_score(y_true, y_pred, zero_division=0), 4),
        "recall": round(recall_score(y_true, y_pred), 4),
        "f1": round(f1_score(y_true, y_pred), 4),
        "fpr": round(fp / (fp + tn), 4),
        "tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp),
    }
    if y_score is not None:
        m["roc_auc"] = round(roc_auc_score(y_true, y_score), 4)
    return m


def measure_latency(detector: SQLiDetector, payloads: list[str]) -> dict:
    """Single-query latency (normalize + vectorize + predict), as in the real-time service."""
    detector.predict(payloads[0])  # warm-up
    lat = np.array([detector.predict(p).latency_ms for p in payloads])
    return {"n": len(lat), "mean_ms": round(float(lat.mean()), 3), "p50_ms": round(float(np.percentile(lat, 50)), 3),
            "p95_ms": round(float(np.percentile(lat, 95)), 3), "max_ms": round(float(lat.max()), 3)}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true", help="3 folds and a smaller grid (for a fast check)")
    args = ap.parse_args()
    folds = 3 if args.quick else 5
    REPORTS.mkdir(exist_ok=True)
    ARTIFACTS.mkdir(exist_ok=True)

    train = pd.read_csv(DATA / "train.csv", keep_default_na=False)
    test = pd.read_csv(DATA / "test.csv", keep_default_na=False)
    X, y = train.normalized.values, train.label.values
    Xt, yt = test.normalized.values, test.label.values

    # ---- Stage 1: feature screening --------------------------------------------------------
    variants = [("char", r) for r in [(1, 3), (2, 4), (2, 5), (3, 5)]] + [("word", r) for r in [(1, 1), (1, 2), (1, 3)]]
    stage1 = []
    for (analyzer, ngram), weighting in product(variants, ["tfidf", "count"]):
        pipe = Pipeline([("vec", build_vectorizer(analyzer, ngram, weighting)), ("clf", rf())])
        row = {"analyzer": analyzer, "ngram": f"{ngram[0]}-{ngram[1]}", "weighting": weighting,
               **cv_eval(pipe, X, y, folds)}
        stage1.append(row)
        print("stage1", row)
    s1 = pd.DataFrame(stage1).sort_values(["f1", "fpr"], ascending=[False, True])
    s1.to_csv(REPORTS / "stage1_features.csv", index=False)
    best = s1.iloc[0]
    best_feat = (best.analyzer, tuple(int(v) for v in best.ngram.split("-")), best.weighting)
    print("best features:", best_feat)

    # ---- Stage 2: RF hyper-parameter tuning --------------------------------------------------
    grid = {"n_estimators": [100, 300], "max_depth": [None, 40], "min_samples_leaf": [1, 2]}
    if args.quick:
        grid = {"n_estimators": [100], "max_depth": [None, 40], "min_samples_leaf": [1]}
    stage2 = []
    for ne, md, msl in product(*grid.values()):
        pipe = Pipeline([("vec", build_vectorizer(*best_feat)),
                         ("clf", rf(n_estimators=ne, max_depth=md, min_samples_leaf=msl))])
        row = {"n_estimators": ne, "max_depth": md if md is not None else "None", "min_samples_leaf": msl,
               **cv_eval(pipe, X, y, folds)}
        stage2.append(row)
        print("stage2", row)
    s2 = pd.DataFrame(stage2).sort_values(["f1", "fpr", "fit_time_s"], ascending=[False, True, True])
    s2.to_csv(REPORTS / "stage2_rf_tuning.csv", index=False)
    b2 = s2.iloc[0]
    rf_params = {"n_estimators": int(b2.n_estimators),
                 "max_depth": None if b2.max_depth == "None" else int(b2.max_depth),
                 "min_samples_leaf": int(b2.min_samples_leaf)}
    print("best RF params:", rf_params)

    # ---- Stage 3 + 4: baselines and held-out test ----------------------------------------------
    models = {
        "RandomForest": rf(**rf_params),
        "MultinomialNB": MultinomialNB(),
        "LogisticRegression": LogisticRegression(max_iter=2000, class_weight="balanced"),
        "LinearSVM": CalibratedClassifierCV(LinearSVC(class_weight="balanced"), cv=3),
    }
    results, cv_rows = {}, []
    final_pipe = None
    for name, clf in models.items():
        pipe = Pipeline([("vec", build_vectorizer(*best_feat)), ("clf", clf)])
        cv_rows.append({"model": name, **cv_eval(pipe, X, y, folds)})
        t0 = time.perf_counter()
        pipe.fit(X, y)
        fit_s = time.perf_counter() - t0
        if name == "RandomForest":
            # Real-time inference scores one value at a time; spawning worker threads per call
            # costs more than it saves, so the deployed model predicts single-threaded.
            pipe.named_steps["clf"].set_params(n_jobs=1)
        proba = pipe.predict_proba(Xt)[:, 1]
        results[name] = {**test_metrics(yt, (proba >= 0.5).astype(int), proba), "fit_time_s": round(fit_s, 2)}
        results[name]["latency"] = measure_latency(SQLiDetector(pipe), list(test.payload.values[:1000]))
        if name == "RandomForest":
            final_pipe = pipe
        print(name, results[name])

    rule_pred = np.array([rule_based_predict(p) for p in test.payload.values])
    results["RuleBased"] = test_metrics(yt, rule_pred)
    cv_rows.append({"model": "RuleBased", "note": "no training; evaluated on test only"})
    pd.DataFrame(cv_rows).to_csv(REPORTS / "stage3_baselines_cv.csv", index=False)

    # Error analysis: what does the final model get wrong?
    rf_proba = final_pipe.predict_proba(Xt)[:, 1]
    errors = test.assign(proba=rf_proba, pred=(rf_proba >= 0.5).astype(int))
    errors[errors.pred != errors.label].to_csv(REPORTS / "test_errors_rf.csv", index=False)

    metadata = {
        "features": {"analyzer": best_feat[0], "ngram_range": list(best_feat[1]), "weighting": best_feat[2]},
        "rf_params": rf_params, "train_rows": len(train), "test_metrics": results["RandomForest"],
        "trained_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    joblib.dump({"pipeline": final_pipe, "threshold": 0.5, "metadata": metadata}, ARTIFACTS / "model.joblib",
                compress=3)
    (REPORTS / "test_results.json").write_text(json.dumps({"best_features": metadata["features"],
                                                           "rf_params": rf_params, "models": results}, indent=2))
    print("saved", ARTIFACTS / "model.joblib")


if __name__ == "__main__":
    main()
