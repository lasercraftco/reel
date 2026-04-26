"""Radarr client — owned library + add."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import get_settings
from app.sources._http import client

log = logging.getLogger(__name__)


def _hdr() -> dict[str, str]:
    s = get_settings()
    return {"X-Api-Key": s.radarr_api_key} if s.radarr_api_key else {}


def _base() -> str:
    return get_settings().radarr_url.rstrip("/")


async def list_movies() -> list[dict[str, Any]]:
    r = await client().get(f"{_base()}/api/v3/movie", headers=_hdr())
    r.raise_for_status()
    return list(r.json())


async def list_quality_profiles() -> list[dict[str, Any]]:
    r = await client().get(f"{_base()}/api/v3/qualityprofile", headers=_hdr())
    r.raise_for_status()
    return list(r.json())


async def lookup(term: str) -> list[dict[str, Any]]:
    r = await client().get(f"{_base()}/api/v3/movie/lookup", params={"term": term}, headers=_hdr())
    r.raise_for_status()
    return list(r.json())


async def lookup_tmdb(tmdb_id: int) -> dict[str, Any] | None:
    r = await client().get(
        f"{_base()}/api/v3/movie/lookup/tmdb", params={"tmdbId": str(tmdb_id)}, headers=_hdr()
    )
    if r.status_code == 404:
        return None
    r.raise_for_status()
    data = r.json()
    if isinstance(data, list):
        return data[0] if data else None
    return data


async def add_movie(
    *,
    tmdb_id: int,
    quality_profile_id: int,
    root_folder_path: str,
    monitored: bool = True,
    search: bool = True,
) -> dict[str, Any]:
    """Add a movie to Radarr by TMDB id."""
    info = await lookup_tmdb(tmdb_id)
    if not info:
        raise ValueError(f"radarr lookup returned nothing for tmdb {tmdb_id}")
    payload: dict[str, Any] = {
        "tmdbId": tmdb_id,
        "title": info.get("title"),
        "year": info.get("year"),
        "qualityProfileId": quality_profile_id,
        "rootFolderPath": root_folder_path,
        "monitored": monitored,
        "minimumAvailability": "released",
        "addOptions": {"searchForMovie": search, "monitor": "movieOnly"},
        "images": info.get("images", []),
        "titleSlug": info.get("titleSlug"),
    }
    r = await client().post(f"{_base()}/api/v3/movie", json=payload, headers=_hdr())
    if r.status_code == 400:
        # Movie may already exist
        try:
            errs = r.json()
            for e in errs if isinstance(errs, list) else []:
                if "MovieExistsValidator" in str(e):
                    log.info("radarr already has tmdb=%s", tmdb_id)
                    return info
        except (ValueError, httpx.HTTPError):
            pass
    r.raise_for_status()
    return r.json()


async def root_folder() -> str | None:
    r = await client().get(f"{_base()}/api/v3/rootfolder", headers=_hdr())
    r.raise_for_status()
    folders = r.json()
    return folders[0]["path"] if folders else None


async def queue() -> list[dict[str, Any]]:
    r = await client().get(f"{_base()}/api/v3/queue", headers=_hdr())
    r.raise_for_status()
    data = r.json() or {}
    return list(data.get("records", []))
