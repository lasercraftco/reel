"""Item2Vec-style scorer — co-view sessions become item embeddings.

We don't ship a heavy ML dep. Instead, we keep a per-item co-occurrence
matrix in Postgres (computed as a side-effect of view_history) and score
candidates by normalized PMI vs. the seed's co-occurrence neighborhood.
The recommender precomputes the neighborhood map into context['cooc_neighbors'].
"""

from __future__ import annotations

from typing import Any


class Item2VecScorer:
    name = "item2vec"
    default_weight = 0.05

    async def score(
        self,
        seed: dict[str, Any],
        candidate: dict[str, Any],
        context: dict[str, Any],
    ) -> tuple[float, dict[str, Any]]:
        neighbors: dict[int, float] = context.get("cooc_neighbors") or {}
        score = neighbors.get(candidate["id"], 0.0)
        return min(score, 1.0), {"cooc_score": round(score, 3) if score else None}
