"""Awards graph scorer — same festival circuit / shortlist often share aesthetic."""

from __future__ import annotations

from typing import Any

PRESTIGE = {
    "academy": 1.0,
    "cannes": 0.9,
    "venice": 0.85,
    "berlin": 0.8,
    "sundance": 0.75,
    "spirit": 0.7,
    "golden globe": 0.6,
    "bafta": 0.6,
}


class AwardsScorer:
    name = "awards"
    default_weight = 0.04

    async def score(
        self,
        seed: dict[str, Any],
        candidate: dict[str, Any],
        context: dict[str, Any],
    ) -> tuple[float, dict[str, Any]]:
        seed_awards = _normalize(seed.get("awards") or [])
        cand_awards = _normalize(candidate.get("awards") or [])
        if not cand_awards:
            return 0.0, {}
        # Strong boost if the candidate shares a circuit with the seed
        shared = seed_awards & {a[0] for a in cand_awards}
        boost = sum(PRESTIGE.get(s, 0.4) for s in shared) * 0.2
        # Standalone prestige floor for any awarded film
        prestige_floor = max((PRESTIGE.get(c, 0.3) for c, _result in cand_awards), default=0.0)
        score = min(prestige_floor * 0.7 + boost, 1.0)
        return score, {"awards_overlap": sorted(shared) or None, "candidate_circuits": sorted({c for c, _ in cand_awards}) or None}


def _normalize(awards: list[Any]) -> set[tuple[str, str]]:
    out: set[tuple[str, str]] = set()
    for a in awards:
        if not isinstance(a, dict):
            continue
        ceremony = str(a.get("ceremony") or "").lower()
        circuit = next((k for k in PRESTIGE if k in ceremony), ceremony or "other")
        result = str(a.get("result") or "")
        out.add((circuit, result))
    return out
