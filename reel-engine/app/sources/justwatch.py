"""JustWatch — placeholder using TMDB /watch/providers data.

TMDB exposes JustWatch data at /movie/{id}/watch/providers — we already
fetch this as part of the TMDB append_to_response. So this module just
normalizes the payload.
"""

from __future__ import annotations

from typing import Any


def normalize(providers_payload: dict[str, Any], *, region: str = "US") -> dict[str, list[dict[str, Any]]]:
    region_data = (providers_payload.get("results") or {}).get(region) or {}
    return {
        "stream": region_data.get("flatrate") or [],
        "rent": region_data.get("rent") or [],
        "buy": region_data.get("buy") or [],
        "free": region_data.get("free") or [],
        "link": region_data.get("link"),
    }
