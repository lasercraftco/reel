"""Library scanner — pulls from Radarr + Plex, upserts movies + library state."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Library, Movie, PlexHistory
from app.services.enrich import enrich_movie
from app.sources import plex, radarr

log = logging.getLogger(__name__)


async def scan_radarr(session: AsyncSession) -> dict[str, int]:
    """Pull every movie from Radarr; upsert into movies + library tables."""
    movies = await radarr.list_movies()
    log.info("radarr returned %d movies", len(movies))
    enriched = 0
    for m in movies:
        tmdb_id = m.get("tmdbId")
        if not tmdb_id:
            continue
        existing = (await session.execute(select(Movie).where(Movie.id == tmdb_id))).scalar_one_or_none()
        if not existing:
            await enrich_movie(session, tmdb_id)
            enriched += 1
        status = _normalize_radarr_status(m)
        plex_key = None
        progress = None
        if m.get("hasFile"):
            status = "imported"
            progress = 100.0
        radarr_id = m.get("id")
        await _upsert_library(
            session,
            movie_id=tmdb_id,
            radarr_id=radarr_id,
            quality_profile_id=m.get("qualityProfileId"),
            status=status,
            progress=progress,
            size_on_disk=m.get("sizeOnDisk"),
            monitored=bool(m.get("monitored", True)),
            plex_key=plex_key,
        )
    await session.commit()
    return {"movies_seen": len(movies), "newly_enriched": enriched}


def _normalize_radarr_status(m: dict[str, Any]) -> str:
    if m.get("hasFile"):
        return "imported"
    if m.get("monitored") and not m.get("hasFile"):
        return "wanted"
    return "missing"


async def _upsert_library(
    session: AsyncSession,
    *,
    movie_id: int,
    radarr_id: int | None,
    quality_profile_id: int | None,
    status: str,
    progress: float | None,
    size_on_disk: int | None,
    monitored: bool,
    plex_key: str | None,
) -> None:
    stmt = pg_insert(Library).values(
        movie_id=movie_id,
        radarr_id=radarr_id,
        quality_profile_id=quality_profile_id,
        status=status,
        progress_percent=progress,
        size_on_disk=size_on_disk,
        monitored=monitored,
        plex_key=plex_key,
        added_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[Library.movie_id],
        set_={
            "radarr_id": radarr_id,
            "quality_profile_id": quality_profile_id,
            "status": status,
            "progress_percent": progress,
            "size_on_disk": size_on_disk,
            "monitored": monitored,
            "updated_at": datetime.utcnow(),
        },
    )
    await session.execute(stmt)


async def scan_plex(session: AsyncSession) -> dict[str, int]:
    """Pull Plex watch history; map to TMDB ids via existing library rows."""
    sections = await plex.libraries()
    if not sections:
        return {"sections": 0, "history_rows": 0}
    history_rows = await plex.history(limit=1000)
    upserted = 0
    for h in history_rows:
        rating_key = h.get("ratingKey") or h.get("@ratingKey")
        viewed_at_raw = h.get("viewedAt") or h.get("@viewedAt")
        try:
            viewed_at = datetime.utcfromtimestamp(int(viewed_at_raw)) if viewed_at_raw else None
        except (ValueError, TypeError):
            viewed_at = None
        # Resolve rating_key -> tmdb id via existing library plex_key when possible
        match = (await session.execute(select(Library).where(Library.plex_key == str(rating_key)))).scalar_one_or_none()
        if not match:
            continue
        await session.execute(
            pg_insert(PlexHistory).values(
                movie_id=match.movie_id,
                plex_key=str(rating_key),
                viewed_at=viewed_at,
                view_count=1,
            )
        )
        upserted += 1
    await session.commit()
    return {"sections": len(sections), "history_rows": upserted}


async def attach_plex_keys(session: AsyncSession) -> int:
    """Attempt to fill library.plex_key for as many rows as possible by matching titles."""
    sections = await plex.libraries()
    matched = 0
    for sec in sections:
        items = await plex.all_movies(sec["key"])
        for it in items:
            title = it.get("title")
            year = it.get("year")
            if not title:
                continue
            row = (
                await session.execute(
                    select(Movie).where(Movie.title == title).limit(1)
                )
            ).scalar_one_or_none()
            if not row:
                continue
            if year and (row.release_date or "").startswith(str(year)) is False:
                continue
            lib = (await session.execute(select(Library).where(Library.movie_id == row.id))).scalar_one_or_none()
            if not lib:
                continue
            lib.plex_key = str(it.get("ratingKey"))
            matched += 1
    await session.commit()
    return matched
