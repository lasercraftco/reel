"""OMDb client — fills in IMDb / RT / Metacritic ratings."""

from __future__ import annotations

import logging
from typing import Any

from app.config import get_settings
from app.sources._http import get_json

log = logging.getLogger(__name__)

BASE = "https://www.omdbapi.com/"


async def by_imdb(imdb_id: str) -> dict[str, Any] | None:
    s = get_settings()
    if not s.omdb_api_key:
        return None
    try:
        data = await get_json(BASE, params={"apikey": s.omdb_api_key, "i": imdb_id, "tomatoes": "true"})
    except Exception as exc:  # noqa: BLE001
        log.debug("omdb %s failed: %s", imdb_id, exc)
        return None
    if not data or data.get("Response") == "False":
        return None
    return _normalize(data)


def _normalize(d: dict[str, Any]) -> dict[str, Any]:
    ratings: dict[str, float] = {}
    for r in d.get("Ratings", []) or []:
        src = r.get("Source", "")
        val = r.get("Value", "")
        try:
            if "Internet Movie Database" in src:
                ratings["imdb"] = float(val.split("/")[0])
            elif "Rotten Tomatoes" in src:
                ratings["rt"] = float(val.replace("%", ""))
            elif "Metacritic" in src:
                ratings["mc"] = float(val.split("/")[0])
        except (ValueError, IndexError):
            continue
    return {
        "imdb_id": d.get("imdbID"),
        "title": d.get("Title"),
        "ratings": ratings,
        "rated": d.get("Rated"),
        "awards": d.get("Awards"),
        "country": d.get("Country"),
    }
