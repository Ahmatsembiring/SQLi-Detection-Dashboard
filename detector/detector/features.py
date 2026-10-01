"""N-gram feature extraction (FR-14)."""
from __future__ import annotations

from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer

# The default sklearn word tokenizer drops punctuation, but quotes, '=', '(' and ';'
# are exactly what distinguishes "o'neil" from "' or '0'='0". Keep them as tokens.
WORD_TOKEN_PATTERN = r"[a-z_@$]+|\d+|[^\sa-z_\d@$]"


def build_vectorizer(
    analyzer: str = "char",
    ngram_range: tuple[int, int] = (2, 5),
    weighting: str = "tfidf",
    max_features: int | None = 20000,
    min_df: int = 2,
):
    """analyzer: 'char' or 'word'; weighting: 'tfidf' or 'count'."""
    cls = TfidfVectorizer if weighting == "tfidf" else CountVectorizer
    kwargs = dict(
        analyzer=analyzer,
        ngram_range=ngram_range,
        max_features=max_features,
        min_df=min_df,
        lowercase=False,  # normalize() already lowercases
    )
    if analyzer == "word":
        kwargs["token_pattern"] = WORD_TOKEN_PATTERN
    if weighting == "tfidf":
        kwargs["sublinear_tf"] = True
    return cls(**kwargs)
