"""Wikipedia plot extraction — long synopsis for embedding-based scoring."""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

from bs4 import BeautifulSoup
from sqlalchemy.ext.asyncio import AsyncSession

from app.sources._http import cache_get, cache_set, get_json, get_text

log = logging.getLogger(__name__)

WIKI_API = "https://en.wikipedia.org/w/api.php"
TTL = int(timedelta(days=30).total_seconds())


async def plot(*, title: str, year: int | str | None, session: AsyncSession) -> str | None:
    key = f"{title}|{year or ''}"
    cached = await cache_get(session, "wiki_plot", key)
    if cached is not None:
        return cached  # type: ignore[no-any-return]
    page = await _find_page(title, year)
    if not page:
        await cache_set(session, "wiki_plot", key, "", ttl_seconds=TTL)
        return None
    try:
        html = await get_text(f"https://en.wikipedia.org/wiki/{page.replace(' ', '_')}")
    except Exception:  # noqa: BLE001
        return None
    soup = BeautifulSoup(html, "lxml")
    out: list[str] = []
    capture = False
    for el in soup.select("h2, h3, p"):
        if el.name in {"h2", "h3"}:
            heading = el.get_text(strip=True).lower()
            capture = heading.startswith("plot")
            if not capture and out:
                break
            continue
        if capture:
            text = el.get_text(strip=True)
            if text:
                out.append(text)
    plot_text = "\n\n".join(out).strip() or None
    await cache_set(session, "wiki_plot", key, plot_text or "", ttl_seconds=TTL)
    return plot_text


async def _find_page(title: str, year: int | str | None) -> str | None:
    queries = [f"{title} (film)"]
    if year:
        queries.insert(0, f"{title} ({year} film)")
    for q in queries:
        try:
            data = await get_json(
                WIKI_API,
                params={"action": "query", "list": "search", "srsearch": q, "format": "json", "srlimit": "3"},
            )
        except Exception:  # noqa: BLE001
            continue
        results = (data or {}).get("query", {}).get("search", [])
        for r in results:
            title_match: str = r.get("title", "")
            if "film" in title_match.lower():
                return title_match
        if results:
            return results[0].get("title")
    return None


async def keywords_via_synopsis(text: str | None) -> list[str]:
    """Cheap keyword extraction — top frequent capitalized noun phrases.

    Used as a fallback when TMDB keywords are sparse.
    """
    if not text:
        return []
    import re
    from collections import Counter

    counts: Counter[str] = Counter(
        m.group(0).strip()
        for m in re.finditer(r"\b[A-Z][a-z]{3,}(?:\s+[A-Z][a-z]+){0,2}\b", text)
    )
    return [w for w, _ in counts.most_common(20)]
