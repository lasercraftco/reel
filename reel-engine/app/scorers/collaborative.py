"""Collaborative scorer — Trakt 'related movies' + per-user item2vec stub."""

from __future__ import annotations

from typing import Any


class CollaborativeScorer:
    name = "collaborative"
    default_weight = 0.14

    async def score(
        self,
        seed: dict[str, Any],
        candidate: dict[str, Any],
        context: dict[str, Any],
    ) -> tuple[float, dict[str, Any]]:
        trakt = (context.get("trakt_related") or {}).get(candidate["id"], 0.0)
        return trakt, {"trakt_related": round(trakt, 3)}
