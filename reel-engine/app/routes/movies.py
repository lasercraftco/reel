"""Movie detail + similar endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Library, Movie
from app.schemas import MovieDetail
from app.services.enrich import enrich_movie
from app.services.recommender import recompute
from app.sources import plex, tmdb

router = APIRouter(prefix="/api/movies", tags=["movies"])


@router.get("/{movie_id}", response_model=MovieDetail)
async def detail(movie_id: int, session: AsyncSession = Depends(get_session)) -> MovieDetail:
    row = (await session.execute(select(Movie).where(Movie.id == movie_id))).scalar_one_or_none()
    if not row:
        row = await enrich_movie(session, movie_id)
        if not row:
            raise HTTPException(404, "movie_not_found")
    lib = (await session.execute(select(Library).where(Library.movie_id == movie_id))).scalar_one_or_none()
    return MovieDetail(
        id=row.id,
        title=row.title,
        original_title=row.original_title,
        original_language=row.original_language,
        overview=row.overview,
        tagline=row.tagline,
        release_date=row.release_date,
        runtime=row.runtime,
        poster_path=row.poster_path,
        backdrop_path=row.backdrop_path,
        vote_average=row.vote_average,
        genres=row.genres or [],
        keywords=row.keywords or [],
        certification=row.certification,
        cast=row.cast or [],
        crew=row.crew or [],
        ratings_external=row.ratings_external or {},
        watch_providers=row.watch_providers or {},
        awards=row.awards or [],
        mood_tags=row.mood_tags or [],
        era_tag=row.era_tag,
        homepage=row.homepage,
        imdb_id=row.imdb_id,
        library_status=lib.status if lib else None,
        plex_key=lib.plex_key if lib else None,
    )


@router.get("/{movie_id}/similar")
async def similar(movie_id: int, limit: int = 24, session: AsyncSession = Depends(get_session)) -> list[dict[str, Any]]:
    raw = await tmdb.similar(movie_id)
    return raw[:limit]


@router.get("/{movie_id}/recommendations")
async def recommendations(movie_id: int, limit: int = 24, session: AsyncSession = Depends(get_session)) -> list[dict[str, Any]]:
    raw = await tmdb.recommendations(movie_id)
    return raw[:limit]


@router.get("/{movie_id}/plex-link")
async def plex_link(movie_id: int, session: AsyncSession = Depends(get_session)) -> dict[str, str | None]:
    lib = (await session.execute(select(Library).where(Library.movie_id == movie_id))).scalar_one_or_none()
    if not lib or not lib.plex_key:
        return {"link": None}
    return {"link": plex.web_deep_link(lib.plex_key)}
