"""Reddit-driven scorer — boost candidates mentioned in r/MovieSuggestions / r/ifyoulikeblank threads."""

from __future__ import annotations

from typing import Any


class RedditScorer:
    name = "reddit"
    default_weight = 0.04

    async def score(
        self,
        seed: dict[str, Any],
        candidate: dict[str, Any],
        context: dict[str, Any],
    ) -> tuple[float, dict[str, Any]]:
        mentioned: set[str] = context.get("reddit_mentions") or set()
        if not mentioned:
            return 0.0, {}
        title = (candidate.get("title") or "").lower()
        if title in mentioned:
            return 0.85, {"reddit_mentioned": True}
        return 0.0, {}
