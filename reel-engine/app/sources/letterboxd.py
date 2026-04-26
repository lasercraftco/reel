"""Letterboxd scraper — gentle, cached, respects robots-of-spirit.

Letterboxd has no public API. We pull the 'similar films' module from a
movie's HTML page. We rate-limit (LETTERBOXD_SCRAPE_DELAY_MS) and cache
in Postgres for 7 days by default.
"""

from __future__ import annotations

import logging
import re
from datetime import timedelta
from typing import Any

from bs4 import BeautifulSoup
from sqlalchemy.ext.asyncio import AsyncSession

from app.sources._http import cache_get, cache_set, letterboxd_get

log = logging.getLogger(__name__)

BASE = "https://letterboxd.com"
TTL = int(timedelta(days=7).total_seconds())


def _slugify(title: str, year: int | str | None) -> str:
    base = re.sub(r"[^a-zA-Z0-9]+", "-", title.lower()).strip("-")
    if year:
        base += f"-{year}"
    return base


async def similar_films(
    *, title: str, year: int | str | None, session: AsyncSession
) -> list[dict[str, Any]]:
    slug = _slugify(title, year)
    cached = await cache_get(session, "letterboxd_similar", slug)
    if cached is not None:
        return cached  # type: ignore[no-any-return]
    try:
        html = await letterboxd_get(f"{BASE}/film/{slug}/")
    except Exception as exc:  # noqa: BLE001
        log.debug("letterboxd similar %s: %s", slug, exc)
        await cache_set(session, "letterboxd_similar", slug, [], ttl_seconds=int(timedelta(days=1).total_seconds()))
        return []
    soup = BeautifulSoup(html, "lxml")
    out: list[dict[str, Any]] = []
    for sect in soup.select("section.section, section.related"):
        h = sect.find(["h2", "h3"])
        if not h or "similar" not in h.get_text(strip=True).lower():
            continue
        for a in sect.select("a.frame, a.film-poster, .film-poster a"):
            target = a.get("href") or ""
            data_id = a.get("data-target-link") or target
            ttl = a.get("data-original-title") or a.get("title") or ""
            if not ttl:
                img = a.find("img")
                if img:
                    ttl = img.get("alt", "")
            out.append({"slug": data_id.strip("/").split("/")[-1], "title": ttl})
        break
    await cache_set(session, "letterboxd_similar", slug, out, ttl_seconds=TTL)
    return out


async def average_rating(
    *, title: str, year: int | str | None, session: AsyncSession
) -> float | None:
    slug = _slugify(title, year)
    cached = await cache_get(session, "letterboxd_rating", slug)
    if cached is not None:
        return cached  # type: ignore[no-any-return]
    try:
        html = await letterboxd_get(f"{BASE}/film/{slug}/ratings/")
    except Exception:  # noqa: BLE001
        return None
    soup = BeautifulSoup(html, "lxml")
    meta = soup.find("meta", attrs={"name": "twitter:data2"})
    rating: float | None = None
    if meta and isinstance(meta.get("content"), str):
        m = re.match(r"([0-9.]+)", meta["content"])
        if m:
            rating = float(m.group(1))
    await cache_set(session, "letterboxd_rating", slug, rating, ttl_seconds=TTL)
    return rating
