"""Crew / cast graph scorer — overlap of director / writer / DoP / composer / lead actor."""

from __future__ import annotations

from typing import Any

WEIGHTS = {
    "Director": 0.40,
    "Writer": 0.15,
    "Director of Photography": 0.10,
    "Original Music Composer": 0.10,
    "Producer": 0.05,
}


def _crew_set(movie: dict[str, Any], jobs: tuple[str, ...]) -> set[tuple[int, str]]:
    out: set[tuple[int, str]] = set()
    for c in movie.get("crew") or []:
        if isinstance(c, dict) and c.get("job") in jobs and c.get("id") is not None:
            out.add((int(c["id"]), str(c["job"])))
    return out


def _cast_set(movie: dict[str, Any], top_n: int = 5) -> set[int]:
    out: set[int] = set()
    cast = movie.get("cast") or []
    for c in cast[:top_n]:
        if isinstance(c, dict) and c.get("id") is not None:
            out.add(int(c["id"]))
    return out


class CrewScorer:
    name = "crew"
    default_weight = 0.10

    async def score(
        self,
        seed: dict[str, Any],
        candidate: dict[str, Any],
        context: dict[str, Any],
    ) -> tuple[float, dict[str, Any]]:
        seed_crew = _crew_set(seed, tuple(WEIGHTS))
        cand_crew = _crew_set(candidate, tuple(WEIGHTS))
        seed_cast = _cast_set(seed)
        cand_cast = _cast_set(candidate)

        score = 0.0
        matches: list[str] = []
        for sid, job in seed_crew:
            if (sid, job) in cand_crew:
                score += WEIGHTS.get(job, 0.05)
                matches.append(f"same {job}")
        if seed_cast & cand_cast:
            overlap = len(seed_cast & cand_cast)
            score += min(0.15 * overlap, 0.25)
            matches.append(f"{overlap} shared lead{'s' if overlap > 1 else ''}")
        score = min(score, 1.0)
        return score, {"crew_match": ", ".join(matches) if matches else None}
