"""Model loading and inference (FR-15, FR-16, FR-19)."""
from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path

import joblib

from .preprocessing import normalize

LABELS = {0: "Normal", 1: "SQLi"}


@dataclass
class Prediction:
    label: str
    probability: float  # probability of the SQLi class
    normalized: str
    latency_ms: float

    @property
    def is_sqli(self) -> bool:
        return self.label == "SQLi"

    @property
    def severity(self) -> str:
        """Coarse severity derived from the SQLi probability (low-priority extra)."""
        if not self.is_sqli:
            return "None"
        if self.probability >= 0.9:
            return "High"
        if self.probability >= 0.7:
            return "Medium"
        return "Low"


class SQLiDetector:
    """Wraps a fitted sklearn Pipeline(vectorizer -> classifier) stored as .joblib."""

    def __init__(self, pipeline, threshold: float = 0.5, metadata: dict | None = None):
        self.pipeline = pipeline
        self.threshold = threshold
        self.metadata = metadata or {}

    @classmethod
    def load(cls, path: str | Path) -> "SQLiDetector":
        bundle = joblib.load(path)
        return cls(bundle["pipeline"], bundle.get("threshold", 0.5), bundle.get("metadata"))

    def predict(self, payload: str) -> Prediction:
        start = time.perf_counter()
        text = normalize(payload)
        proba = float(self.pipeline.predict_proba([text])[0][1]) if text else 0.0
        latency = (time.perf_counter() - start) * 1000
        label = LABELS[int(proba >= self.threshold)]
        return Prediction(label, proba, text, latency)
