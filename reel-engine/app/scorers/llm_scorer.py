"""LLM scorer — when context.llm_rerank is populated (top-K only)."""

from __future__ import annotations

from typing import Any


class LLMScorer:
    name = "llm"
    default_weight = 0.05

    async def score(
        self,
        seed: dict[str, Any],
        candidate: dict[str, Any],
        context: dict[str, Any],
    ) -> tuple[float, dict[str, Any]]:
        rank_score: float = (context.get("llm_rerank") or {}).get(candidate["id"], 0.0)
        if not rank_score:
            return 0.0, {}
        return rank_score, {"llm_rank_score": round(rank_score, 3)}
