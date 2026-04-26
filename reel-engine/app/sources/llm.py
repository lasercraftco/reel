"""Anthropic-augmented deep-rerank + 'why this movie?' explanations."""

from __future__ import annotations

import json
import logging
from typing import Any

from anthropic import AsyncAnthropic

from app.config import get_settings

log = logging.getLogger(__name__)

_client: AsyncAnthropic | None = None


def _get_client() -> AsyncAnthropic | None:
    global _client
    s = get_settings()
    if not s.anthropic_api_key:
        return None
    if _client is None:
        _client = AsyncAnthropic(api_key=s.anthropic_api_key)
    return _client


async def deep_rerank(
    *,
    seed_summary: str,
    candidates: list[dict[str, Any]],
    history_summary: str,
    top_k: int = 25,
) -> list[int]:
    """Re-rank top candidates using Claude. Returns list of movie ids in new order."""
    client = _get_client()
    if not client:
        return [c["id"] for c in candidates]
    cand_lines = [
        f"{c['id']}: {c['title']} ({(c.get('release_date') or '????')[:4]}) — {(c.get('overview') or '')[:160]}"
        for c in candidates
    ]
    prompt = (
        "You are a careful, taste-aware film recommender. The user is described below.\n"
        f"USER TASTE: {history_summary}\n"
        f"SEED CONTEXT: {seed_summary}\n\n"
        "Re-rank these candidate films from most to least likely the user would love.\n"
        "Use any signals you can read: theme, mood, style, era, director, audience, runtime.\n"
        "Return STRICT JSON: {\"ranking\": [<id>, <id>, ...]} — nothing else.\n\n"
        "CANDIDATES:\n" + "\n".join(cand_lines)
    )
    try:
        resp = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(b.text for b in resp.content if hasattr(b, "text"))
        data = _parse_json(text)
        ids = [int(x) for x in data.get("ranking", [])]
        return ids[:top_k]
    except Exception as exc:  # noqa: BLE001
        log.warning("LLM rerank failed: %s", exc)
        return [c["id"] for c in candidates]


async def why_this_movie(*, seed_summary: str, candidate: dict[str, Any], signals: dict[str, Any]) -> str:
    client = _get_client()
    if not client:
        return _fallback_why(candidate, signals)
    prompt = (
        f"User taste / seed: {seed_summary}\n"
        f"Candidate: {candidate.get('title')} ({(candidate.get('release_date') or '')[:4]}) — "
        f"{(candidate.get('overview') or '')[:240]}\n"
        f"Signals: {json.dumps({k: v for k, v in signals.items() if k != 'reason'}, default=str)[:600]}\n\n"
        "Write ONE concise sentence (<=180 chars) explaining why this user would love this movie. "
        "Plain text, no quotes."
    )
    try:
        resp = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=120,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(b.text for b in resp.content if hasattr(b, "text"))
        return text.strip().strip('"').strip("'")
    except Exception as exc:  # noqa: BLE001
        log.debug("why-this-movie LLM failed: %s", exc)
        return _fallback_why(candidate, signals)


def _fallback_why(candidate: dict[str, Any], signals: dict[str, Any]) -> str:
    bits: list[str] = []
    if signals.get("letterboxd_similar"):
        bits.append("Letterboxd users grouped this with films you've loved")
    if signals.get("tmdb_similar"):
        bits.append("TMDB lists it alongside your seed")
    if signals.get("crew_match"):
        bits.append(f"shares {signals['crew_match']}")
    if signals.get("plot_similarity"):
        bits.append("its synopsis matches your taste vector")
    if not bits:
        bits.append(f"highly rated by audiences who liked your seed (avg {candidate.get('vote_average', 0):.1f})")
    return f"{candidate.get('title')}: " + ", ".join(bits) + "."


def _parse_json(text: str) -> dict[str, Any]:
    text = text.strip()
    # Strip code-fences if present
    if text.startswith("```"):
        text = text.strip("`")
        # remove leading 'json\n'
        if "\n" in text:
            text = text.split("\n", 1)[1]
        text = text.strip("`")
    try:
        return json.loads(text)  # type: ignore[no-any-return]
    except json.JSONDecodeError:
        # Try to extract a {} block
        i, j = text.find("{"), text.rfind("}")
        if i >= 0 and j > i:
            return json.loads(text[i : j + 1])  # type: ignore[no-any-return]
        return {}
