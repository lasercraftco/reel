"""Critic + popularity scorer — ensemble of RT / MC / IMDb / Letterboxd / TMDB."""

from __future__ import annotations

from typing import Any


class CriticScorer:
    name = "critic"
    default_weight = 0.06

    async def score(
        self,
        seed: dict[str, Any],
        candidate: dict[str, Any],
        context: dict[str, Any],
    ) -> tuple[float, dict[str, Any]]:
        ext = candidate.get("ratings_external") or {}
        rt = (ext.get("rt") or 0.0) / 100.0
        mc = (ext.get("mc") or 0.0) / 100.0
        imdb = (ext.get("imdb") or 0.0) / 10.0
        lb = (ext.get("letterboxd") or 0.0) / 5.0
        tmdb = (candidate.get("vote_average") or 0.0) / 10.0
        # Take a generous-but-anchored average across whichever ratings exist
        scores = [s for s in (rt, mc, imdb, lb, tmdb) if s > 0]
        if not scores:
            return 0.5, {}
        avg = sum(scores) / len(scores)
        # Soft popularity penalty so all-time-classics don't dominate
        pop_factor = 1.0
        pop = candidate.get("popularity") or 0.0
        if pop > 200:
            pop_factor = 0.85
        if pop > 500:
            pop_factor = 0.75
        return avg * pop_factor, {
            "critic_avg": round(avg, 2),
            "ratings": {k: round(v, 2) for k, v in {"rt": rt, "mc": mc, "imdb": imdb, "lb": lb, "tmdb": tmdb}.items() if v},
        }
