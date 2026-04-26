"""TMDB similar + recommendations scorer — both endpoints, combined."""

from __future__ import annotations

from typing import Any


class TmdbSimilarScorer:
    name = "tmdb_similar"
    default_weight = 0.10

    async def score(
        self,
        seed: dict[str, Any],
        candidate: dict[str, Any],
        context: dict[str, Any],
    ) -> tuple[float, dict[str, Any]]:
        sim_score: float = (context.get("tmdb_similar_rank") or {}).get(candidate["id"], 0.0)
        rec_score: float = (context.get("tmdb_rec_rank") or {}).get(candidate["id"], 0.0)
        score = max(sim_score, rec_score)
        return score, {
            "tmdb_similar": round(sim_score, 3),
            "tmdb_recommendations": round(rec_score, 3),
        }
