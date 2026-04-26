"""Letterboxd scorer — boost candidates that appear in seed's Letterboxd 'similar films' panel."""

from __future__ import annotations

from typing import Any


class LetterboxdScorer:
    name = "letterboxd"
    default_weight = 0.14

    async def score(
        self,
        seed: dict[str, Any],
        candidate: dict[str, Any],
        context: dict[str, Any],
    ) -> tuple[float, dict[str, Any]]:
        slugs: set[str] = context.get("letterboxd_similar_slugs") or set()
        slug = (candidate.get("title") or "").lower().replace(" ", "-")
        # Letterboxd slugs are messy — the candidate enrichment step should
        # pre-resolve a slug into context['slug_for_movie'] mapping if available.
        cand_slug = (context.get("slug_for_movie") or {}).get(candidate["id"], slug)
        if cand_slug and cand_slug in slugs:
            return 0.95, {"letterboxd_similar": True}
        # Letterboxd rating boost — gentle global signal
        rating: float = (candidate.get("ratings_external") or {}).get("letterboxd") or 0.0
        return min(rating / 5.0, 0.6), {"letterboxd_rating": round(rating, 2)}
