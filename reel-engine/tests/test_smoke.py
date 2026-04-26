"""Smoke tests — make sure modules import and basic math works."""

from __future__ import annotations


def test_imports() -> None:
    from app import scorers
    from app.scorers import REGISTERED
    from app.services import recommender
    from app.services import enrich
    from app.sources import tmdb, omdb, radarr, plex, letterboxd, trakt, reddit, wikipedia, llm
    assert len(REGISTERED) == 11


def test_feature_vector() -> None:
    from app.scorers._math import cosine, feature_vector
    a = feature_vector(
        {"genres": [{"id": 28}, {"id": 12}], "release_date": "2010-05-01", "runtime": 120, "vote_average": 7.5, "popularity": 50}
    )
    b = feature_vector(
        {"genres": [{"id": 28}], "release_date": "2012-08-12", "runtime": 130, "vote_average": 7.0, "popularity": 30}
    )
    sim = cosine(a, b)
    assert 0.0 <= sim <= 1.0
    assert sim > 0.4


def test_jaccard() -> None:
    from app.scorers._math import jaccard
    assert jaccard({"a", "b"}, {"a", "c"}) == 1 / 3


def test_bow_similarity() -> None:
    from app.scorers._math import bow_cosine, text_to_bow
    a = text_to_bow("Two cowboys ride into a haunted desert town to face a vengeful ghost.")
    b = text_to_bow("A ghost in a desert town haunts the cowboys who arrive at dusk.")
    assert bow_cosine(a, b) > 0.5
