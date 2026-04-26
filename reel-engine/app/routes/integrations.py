"""Cross-app integrations — Plex deep links, Genome (soundtracks), Karaoke (movie songs)."""

from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Library, Movie

router = APIRouter(prefix="/api/integrations", tags=["integrations"])

GENOME_URL = os.environ.get("GENOME_PUBLIC_URL", "https://genome.tyflix.net")
KARAOKE_URL = os.environ.get("KARAOKE_PUBLIC_URL", "https://karaoke.tyflix.net")


@router.get("/plex/{movie_id}")
async def plex(movie_id: int, session: AsyncSession = Depends(get_session)) -> dict[str, str | None]:
    from app.sources import plex as plex_src

    lib = (await session.execute(select(Library).where(Library.movie_id == movie_id))).scalar_one_or_none()
    if not lib or not lib.plex_key:
        return {"link": None}
    return {"link": plex_src.web_deep_link(lib.plex_key)}


@router.get("/soundtrack/{movie_id}")
async def soundtrack(movie_id: int, session: AsyncSession = Depends(get_session)) -> dict[str, Any]:
    """Suggest 'open in Genome' deep link to find this movie's soundtrack."""
    movie = (await session.execute(select(Movie).where(Movie.id == movie_id))).scalar_one_or_none()
    if not movie:
        return {"available": False}
    composer = next(
        (c.get("name") for c in (movie.crew or []) if c.get("job") == "Original Music Composer"),
        None,
    )
    if composer:
        url = f"{GENOME_URL}/search?artist={composer.replace(' ', '+')}"
        return {"available": True, "kind": "composer", "label": composer, "url": url}
    title_q = f"{movie.title} soundtrack"
    return {
        "available": True,
        "kind": "title",
        "label": movie.title,
        "url": f"{GENOME_URL}/search?q={title_q.replace(' ', '+')}",
    }


@router.get("/karaoke/{movie_id}")
async def karaoke(movie_id: int, session: AsyncSession = Depends(get_session)) -> dict[str, Any]:
    """Suggest karaoke-able tracks from a movie (forwards to Karaoke search)."""
    movie = (await session.execute(select(Movie).where(Movie.id == movie_id))).scalar_one_or_none()
    if not movie:
        return {"available": False}
    return {
        "available": True,
        "label": movie.title,
        "url": f"{KARAOKE_URL}/songs?from={movie.title.replace(' ', '+')}",
    }
