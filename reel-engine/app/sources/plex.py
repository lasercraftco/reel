"""Plex client — read-only access to library + watch history."""

from __future__ import annotations

import logging
import xml.etree.ElementTree as ET
from typing import Any

from app.config import get_settings
from app.sources._http import client

log = logging.getLogger(__name__)


def _hdr() -> dict[str, str]:
    s = get_settings()
    return {
        "X-Plex-Token": s.plex_token,
        "X-Plex-Client-Identifier": "reel-engine",
        "Accept": "application/json",
    }


def _base() -> str:
    return get_settings().plex_url.rstrip("/")


async def libraries() -> list[dict[str, Any]]:
    s = get_settings()
    if not s.plex_token:
        return []
    r = await client().get(f"{_base()}/library/sections", headers=_hdr())
    r.raise_for_status()
    data = r.json().get("MediaContainer", {})
    return [d for d in data.get("Directory", []) if d.get("type") == "movie"]


async def all_movies(section_id: str) -> list[dict[str, Any]]:
    r = await client().get(f"{_base()}/library/sections/{section_id}/all", headers=_hdr())
    r.raise_for_status()
    data = r.json().get("MediaContainer", {})
    return list(data.get("Metadata", []))


async def history(limit: int = 500) -> list[dict[str, Any]]:
    """Server-wide watch history (movie scrobbles)."""
    s = get_settings()
    if not s.plex_token:
        return []
    r = await client().get(
        f"{_base()}/status/sessions/history/all",
        headers=_hdr(),
        params={"X-Plex-Container-Start": "0", "X-Plex-Container-Size": str(limit), "type": "1"},
    )
    if r.status_code != 200:
        return []
    try:
        data = r.json().get("MediaContainer", {})
        return list(data.get("Metadata", []))
    except ValueError:
        # Some plex servers return XML even with Accept: application/json
        try:
            root = ET.fromstring(r.text)
            return [e.attrib for e in root.findall(".//Video")]
        except ET.ParseError:
            return []


async def now_playing() -> list[dict[str, Any]]:
    s = get_settings()
    if not s.plex_token:
        return []
    r = await client().get(f"{_base()}/status/sessions", headers=_hdr())
    if r.status_code != 200:
        return []
    try:
        data = r.json().get("MediaContainer", {})
        return list(data.get("Metadata", []))
    except ValueError:
        return []


def web_deep_link(plex_key: str) -> str | None:
    s = get_settings()
    if not s.plex_machine_id:
        return None
    return (
        f"https://plex.tyflix.net/web/index.html#!/server/{s.plex_machine_id}"
        f"/details?key={plex_key}"
    )
