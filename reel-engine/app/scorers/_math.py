"""Math helpers for scoring."""

from __future__ import annotations

import math
from collections.abc import Iterable, Sequence
from typing import Any

# Genre id space matches TMDB. We treat it as a fixed-size one-hot.
TMDB_GENRES = (
    28, 12, 16, 35, 80, 99, 18, 10751, 14, 36,
    27, 10402, 9648, 10749, 878, 10770, 53, 10752, 37,
)
DECADE_BINS = (1920, 1940, 1960, 1970, 1980, 1990, 2000, 2010, 2020)
RUNTIME_BINS = (60, 90, 105, 120, 135, 150, 180, 240)
LANGUAGE_VOCAB = ("en", "fr", "es", "de", "it", "ja", "ko", "zh", "ru", "pt", "hi", "sv", "da")


def _one_hot(values: Iterable[Any], vocab: Sequence[Any]) -> list[float]:
    s = set(values)
    return [1.0 if v in s else 0.0 for v in vocab]


def _bucket(value: float | None, bins: Sequence[int]) -> list[float]:
    out = [0.0] * len(bins)
    if value is None:
        return out
    for i, b in enumerate(bins):
        if value >= b:
            continue
        out[i] = 1.0
        return out
    out[-1] = 1.0
    return out


def feature_vector(movie: dict[str, Any]) -> list[float]:
    """Produce a content-based feature vector for cosine similarity."""
    genres = movie.get("genres") or []
    genre_ids = [g.get("id") for g in genres if isinstance(g, dict)]
    runtime = movie.get("runtime")
    rdate = movie.get("release_date") or ""
    year = int(rdate[:4]) if rdate[:4].isdigit() else None
    languages = [movie.get("original_language") or ""]

    rating = movie.get("vote_average") or 0.0
    popularity = math.log10((movie.get("popularity") or 0.0) + 1.0)

    vec: list[float] = []
    vec.extend(_one_hot(genre_ids, TMDB_GENRES))
    vec.extend(_bucket(year, DECADE_BINS))
    vec.extend(_bucket(runtime, RUNTIME_BINS))
    vec.extend(_one_hot(languages, LANGUAGE_VOCAB))
    vec.append(min(rating, 10.0) / 10.0)
    vec.append(min(popularity, 5.0) / 5.0)
    return vec


def cosine(a: Sequence[float], b: Sequence[float]) -> float:
    if not a or not b:
        return 0.0
    n = min(len(a), len(b))
    dot = sum(a[i] * b[i] for i in range(n))
    na = math.sqrt(sum(x * x for x in a[:n]))
    nb = math.sqrt(sum(y * y for y in b[:n]))
    return dot / (na * nb) if na and nb else 0.0


def jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 0.0
    return len(a & b) / max(1, len(a | b))


def text_to_bow(text: str | None) -> dict[str, int]:
    """Tiny bag-of-words for plot text. Used by PlotEmbeddingScorer when no
    real embedding model is available — keeps the engine dependency-light
    while still giving useful similarity."""
    if not text:
        return {}
    import re
    from collections import Counter

    tokens = [
        t.lower()
        for t in re.findall(r"\b[a-zA-Z]{3,}\b", text)
    ]
    stops = {
        "the", "and", "for", "but", "with", "this", "that", "from", "into",
        "their", "they", "them", "then", "than", "his", "her", "him", "she",
        "have", "has", "had", "are", "was", "were", "been", "being", "where",
        "when", "what", "who", "whom", "which", "while", "after", "before",
        "about", "between", "during", "through", "over", "under", "above",
        "below", "out", "off", "down", "again", "more", "most", "some", "any",
        "all", "each", "few", "other", "such", "only", "own", "same", "very",
    }
    return dict(Counter(t for t in tokens if t not in stops))


def bow_cosine(a: dict[str, int], b: dict[str, int]) -> float:
    if not a or not b:
        return 0.0
    common = set(a) & set(b)
    if not common:
        return 0.0
    dot = sum(a[t] * b[t] for t in common)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    return dot / (na * nb) if na and nb else 0.0
