"""Simple signature-based detector, used only as a baseline in the experiments."""
from __future__ import annotations

import re

from .preprocessing import normalize

_RULES = [
    r"\bunion\b.*\bselect\b",
    r"\bselect\b.*\bfrom\b",
    r"['\"`)]\s*(or|and|xor|\|\||&&)\s",
    r"\b(or|and)\b\s*['\"]?\w+['\"]?\s*(=|like|<|>)\s*['\"]?\w+",
    r"\b(sleep|benchmark|pg_sleep|waitfor\s+delay)\b",
    r";\s*(drop|insert|update|delete|select|create|alter|exec|shutdown)\b",
    r"sqlcomment",
    r"\b(information_schema|sysobjects|pg_catalog|sqlite_master|@@version)\b",
    r"\b(extractvalue|updatexml|load_file|into\s+outfile)\b",
    r"\b(char|chr|concat)\s*\(",
]
_COMPILED = [re.compile(r) for r in _RULES]


def rule_based_predict(payload: str) -> int:
    text = normalize(payload)
    return int(any(r.search(text) for r in _COMPILED))
