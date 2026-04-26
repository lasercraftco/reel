"""Plot embedding scorer — bag-of-words cosine on synopsis text.

A real sentence-transformer would be better but adds heavy deps; we use BOW
cosine on (overview + tagline + keywords + cached Wikipedia synopsis) which
is good enough as one signal in an 11-scorer ensemble.
"""

from __future__ import annotations

from typing import Any

from app.scorers._math import bow_cosine, text_to_bow


class PlotEmbeddingScorer:
    name = "plot_embedding"
    default_weight = 0.10

    async def score(
        self,
        seed: dict[str, Any],
        candidate: dict[str, Any],
        context: dict[str, Any],
    ) -> tuple[float, dict[str, Any]]:
        seed_text = _movie_text(seed, context.get("seed_plot"))
        cand_text = _movie_text(candidate, (context.get("plot_text") or {}).get(candidate["id"]))
        a = text_to_bow(seed_text)
        b = text_to_bow(cand_text)
        sim = bow_cosine(a, b)
        return sim, {"plot_similarity": round(sim, 3)}


def _movie_text(movie: dict[str, Any], extra_plot: str | None) -> str:
    parts: list[str] = []
    if movie.get("overview"):
        parts.append(str(movie["overview"]))
    if movie.get("tagline"):
        parts.append(str(movie["tagline"]))
    for kw in movie.get("keywords") or []:
        if isinstance(kw, dict) and kw.get("name"):
            parts.append(str(kw["name"]))
    if extra_plot:
        parts.append(extra_plot)
    return " ".join(parts)
