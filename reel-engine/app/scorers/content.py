"""Content-based scorer — cosine on the (genre × decade × runtime × language × rating) vector."""

from __future__ import annotations

from typing import Any

from app.scorers._math import cosine, feature_vector


class ContentScorer:
    name = "content"
    default_weight = 0.18

    async def score(
        self,
        seed: dict[str, Any],
        candidate: dict[str, Any],
        context: dict[str, Any],
    ) -> tuple[float, dict[str, Any]]:
        sv = feature_vector(seed)
        cv = feature_vector(candidate)
        sim = cosine(sv, cv)
        return sim, {"content_sim": round(sim, 3)}
