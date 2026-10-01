"""Payload normalization (FR-13).

The same function is used at training time and at inference time, so the model
always sees text in exactly the same shape.
"""
from __future__ import annotations

import html
import re
import unicodedata
from urllib.parse import unquote_plus

MAX_DECODE_ROUNDS = 5

# MySQL "versioned" comments (/*!50000 union*/) execute their content, so we keep it.
_VERSIONED_COMMENT = re.compile(r"/\*!\d*(.*?)\*/", re.DOTALL)
_BLOCK_COMMENT = re.compile(r"/\*.*?(\*/|$)", re.DOTALL)
# "--" followed by space/end, or "#", starts a line comment in SQL dialects.
_LINE_COMMENT = re.compile(r"(--|#)[^\n]*")
_DIGITS = re.compile(r"\d+")
_WHITESPACE = re.compile(r"\s+")

# Comments are removed (they are used to obfuscate keywords, e.g. un/**/ion),
# but the *fact* that a line comment terminated the input is a strong signal,
# so it is kept as a single placeholder token.
COMMENT_TOKEN = " sqlcomment "


def url_decode_repeated(text: str, max_rounds: int = MAX_DECODE_ROUNDS) -> str:
    """Decode until stable to defeat double/triple URL encoding (%2527 -> %27 -> ')."""
    for _ in range(max_rounds):
        decoded = unquote_plus(text)
        if decoded == text:
            break
        text = decoded
    return text


def strip_sql_comments(text: str) -> str:
    text = _VERSIONED_COMMENT.sub(r" \1 ", text)
    text = _BLOCK_COMMENT.sub(" ", text)
    return _LINE_COMMENT.sub(COMMENT_TOKEN, text)


def normalize(payload: str | None) -> str:
    """Full normalization pipeline: decode -> unicode -> lowercase -> comments -> digits -> whitespace."""
    if not payload:
        return ""
    text = url_decode_repeated(str(payload))
    text = html.unescape(text)
    # NFKC folds full-width / compatibility characters (e.g. 'ＳＥＬＥＣＴ' -> 'SELECT').
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("\x00", " ")
    text = text.lower()
    text = strip_sql_comments(text)
    # Literal numbers carry no meaning by themselves; "4092=4092" and "1=1" are the same pattern.
    text = _DIGITS.sub("0", text)
    return _WHITESPACE.sub(" ", text).strip()
