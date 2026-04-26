"""Reddit "if you liked X, try Y" pattern miner.

Uses public JSON endpoints — no auth required. Cached per (movie_title, subreddit).
"""

from __future__ import annotations

import logging
import re
from datetime import timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.sources._http import cache_get, cache_set, get_json

log = logging.getLogger(__name__)

SUBREDDITS = ("MovieSuggestions", "ifyoulikeblank", "criterion", "horror", "TrueFilm")
TTL = int(timedelta(days=14).total_seconds())


async def recommendations_for(title: str, *, session: AsyncSession, limit: int = 20) -> list[str]:
    cached = await cache_get(session, "reddit_iyl", title.lower())
    if cached is not None:
        return cached  # type: ignore[no-any-return]
    out: list[str] = []
    for sub in SUBREDDITS:
        try:
            data = await get_json(
                f"https://www.reddit.com/r/{sub}/search.json",
                params={
                    "q": f'"{title}"',
                    "restrict_sr": "1",
                    "sort": "relevance",
                    "t": "year",
                    "limit": "20",
                },
                headers={"User-Agent": "Reel/1.0 by tyler"},
            )
        except Exception as exc:  # noqa: BLE001
            log.debug("reddit %s/%s: %s", sub, title, exc)
            continue
        for child in (data or {}).get("data", {}).get("children", []):
            text = child.get("data", {}).get("selftext", "") + " " + child.get("data", {}).get("title", "")
            for cand in _extract_candidates(text, exclude=title):
                if cand not in out:
                    out.append(cand)
            if len(out) >= limit * 3:
                break
        if len(out) >= limit * 3:
            break
    out = out[:limit]
    await cache_set(session, "reddit_iyl", title.lower(), out, ttl_seconds=TTL)
    return out


_TITLE_RE = re.compile(r"\b([A-Z][\w'!-]+(?:\s+[A-Z][\w'!-]+){0,5})\s*\((\d{4})\)")


def _extract_candidates(text: str, *, exclude: str) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for m in _TITLE_RE.finditer(text):
        title, _year = m.group(1).strip(), m.group(2)
        if title.lower() == exclude.lower():
            continue
        if title in seen:
            continue
        seen.add(title)
        out.append(title)
    return out
