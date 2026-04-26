"""Trakt client — collaborative-filtering signals."""

from __future__ import annotations

import logging
from typing import Any

from app.config import get_settings
from app.sources._http import client

log = logging.getLogger(__name__)

BASE = "https://api.trakt.tv"


def _hdr() -> dict[str, str]:
    s = get_settings()
    headers: dict[str, str] = {
        "trakt-api-version": "2",
        "trakt-api-key": s.trakt_client_id or "",
        "Content-Type": "application/json",
    }
    if s.trakt_access_token:
        headers["Authorization"] = f"Bearer {s.trakt_access_token}"
    return headers


async def related(tmdb_id: int, *, limit: int = 20) -> list[dict[str, Any]]:
    s = get_settings()
    if not s.trakt_client_id:
        return []
    try:
        r = await client().get(f"{BASE}/movies/tmdb-{tmdb_id}/related", headers=_hdr(), params={"limit": str(limit)})
        if r.status_code != 200:
            return []
        return list(r.json())
    except Exception as exc:  # noqa: BLE001
        log.debug("trakt related %s: %s", tmdb_id, exc)
        return []


async def recommendations() -> list[dict[str, Any]]:
    s = get_settings()
    if not s.trakt_access_token:
        return []
    try:
        r = await client().get(f"{BASE}/recommendations/movies", headers=_hdr())
        if r.status_code != 200:
            return []
        return list(r.json())
    except Exception:  # noqa: BLE001
        return []
