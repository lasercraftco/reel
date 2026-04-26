"""TMDB API client — primary metadata source."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.sources._http import cache_get, cache_set, get_json

log = logging.getLogger(__name__)

BASE = "https://api.themoviedb.org/3"


def _auth_params() -> dict[str, str]:
    s = get_settings()
    return {"api_key": s.tmdb_api_key} if s.tmdb_api_key else {}


def _auth_headers() -> dict[str, str]:
    s = get_settings()
    if s.tmdb_read_token:
        return {"Authorization": f"Bearer {s.tmdb_read_token}"}
    return {}


async def search_movies(query: str, *, limit: int = 20) -> list[dict[str, Any]]:
    params = {**_auth_params(), "query": query, "include_adult": "false", "page": "1"}
    data = await get_json(f"{BASE}/search/movie", params=params, headers=_auth_headers())
    return list((data or {}).get("results", []))[:limit]


async def movie(tmdb_id: int, *, session: AsyncSession | None = None) -> dict[str, Any] | None:
    cache_key = f"movie:{tmdb_id}"
    if session:
        cached = await cache_get(session, "tmdb", cache_key)
        if cached:
            return cached  # type: ignore[no-any-return]
    params = {
        **_auth_params(),
        "append_to_response": "credits,keywords,recommendations,similar,external_ids,release_dates,videos,watch/providers",
    }
    try:
        data = await get_json(f"{BASE}/movie/{tmdb_id}", params=params, headers=_auth_headers())
    except Exception as exc:  # noqa: BLE001
        log.warning("tmdb movie %s failed: %s", tmdb_id, exc)
        return None
    if session and data:
        await cache_set(session, "tmdb", cache_key, data, ttl_seconds=get_settings().tmdb_cache_ttl_seconds)
    return data


async def similar(tmdb_id: int) -> list[dict[str, Any]]:
    data = await get_json(f"{BASE}/movie/{tmdb_id}/similar", params=_auth_params(), headers=_auth_headers())
    return list((data or {}).get("results", []))


async def recommendations(tmdb_id: int) -> list[dict[str, Any]]:
    data = await get_json(
        f"{BASE}/movie/{tmdb_id}/recommendations", params=_auth_params(), headers=_auth_headers()
    )
    return list((data or {}).get("results", []))


async def discover(*, page: int = 1, **filters: Any) -> list[dict[str, Any]]:
    params = {**_auth_params(), **{k: str(v) for k, v in filters.items()}, "page": str(page)}
    data = await get_json(f"{BASE}/discover/movie", params=params, headers=_auth_headers())
    return list((data or {}).get("results", []))


async def credits_for_person(person_id: int) -> dict[str, Any]:
    data = await get_json(
        f"{BASE}/person/{person_id}/movie_credits", params=_auth_params(), headers=_auth_headers()
    )
    return data or {}


async def by_imdb(imdb_id: str) -> dict[str, Any] | None:
    data = await get_json(
        f"{BASE}/find/{imdb_id}", params={**_auth_params(), "external_source": "imdb_id"}, headers=_auth_headers()
    )
    results = (data or {}).get("movie_results", [])
    return results[0] if results else None
