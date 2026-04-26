"""Recommendation endpoints — for-you, seed-based, similar-to."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import TyflixUser, get_current_user
from app.db import get_session
from app.models import Library, Movie, Recommendation
from app.schemas import ForYouRequest, SeedRequest
from app.services.recommender import recompute
from app.sources import plex

router = APIRouter(prefix="/api/recommend", tags=["recommend"])


@router.post("/foryou")
async def foryou(
    body: ForYouRequest,
    session: AsyncSession = Depends(get_session),
    user: TyflixUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    if body.user_id != user.id:
        body.user_id = user.id  # never trust client-provided user id
    scored = await recompute(
        session,
        user_id=user.id,
        mode=body.mode,
        seed_movie_id=None,
        limit=body.limit,
        deep_think=body.deep_think,
        filters=body.filters,
    )
    return await _decorate(session, scored)


@router.post("/seed")
async def seed(
    body: SeedRequest,
    session: AsyncSession = Depends(get_session),
    user: TyflixUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    scored = await recompute(
        session,
        user_id=user.id,
        mode="seed",
        seed_movie_id=body.seed_movie_id,
        limit=body.limit,
        deep_think=False,
    )
    return await _decorate(session, scored)


@router.get("/cached")
async def cached(
    mode: str = Query("foryou"),
    limit: int = Query(60),
    seed_key: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
    user: TyflixUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    rows = (
        await session.execute(
            select(Recommendation, Movie)
            .join(Movie, Recommendation.movie_id == Movie.id)
            .where(
                (Recommendation.user_id == user.id)
                & (Recommendation.mode == mode)
                & ((Recommendation.seed_key == seed_key) if seed_key else (Recommendation.seed_key.is_(None)))
            )
            .order_by(Recommendation.rank.asc())
            .limit(limit)
        )
    ).all()
    if not rows:
        return []
    out: list[dict[str, Any]] = []
    movie_ids = [m.id for _r, m in rows]
    libs = await _library_states(session, movie_ids)
    for r, m in rows:
        out.append(_payload(r, m, libs))
    return out


async def _decorate(session: AsyncSession, scored: list[dict[str, Any]]) -> list[dict[str, Any]]:
    movie_ids = [s["candidate"]["id"] for s in scored]
    libs = await _library_states(session, movie_ids)
    out: list[dict[str, Any]] = []
    for s in scored:
        cand = s["candidate"]
        out.append(
            {
                "movie": cand,
                "score": round(s["score"], 4),
                "rank": s["rank"],
                "per_scorer": s["per_scorer"],
                "explanation": s["explanation"],
                "library": libs.get(cand["id"], {"in_library": False}),
            }
        )
    return out


async def _library_states(session: AsyncSession, movie_ids: list[int]) -> dict[int, dict[str, Any]]:
    if not movie_ids:
        return {}
    rows = (await session.execute(select(Library).where(Library.movie_id.in_(movie_ids)))).scalars().all()
    out: dict[int, dict[str, Any]] = {}
    for r in rows:
        out[r.movie_id] = {
            "in_library": r.status in {"imported", "downloaded"},
            "status": r.status,
            "progress": r.progress_percent,
            "plex_link": plex.web_deep_link(r.plex_key) if r.plex_key else None,
        }
    return out


def _payload(rec: Recommendation, movie: Movie, libs: dict[int, dict[str, Any]]) -> dict[str, Any]:
    return {
        "movie": {
            "id": movie.id,
            "title": movie.title,
            "release_date": movie.release_date,
            "poster_path": movie.poster_path,
            "backdrop_path": movie.backdrop_path,
            "overview": movie.overview,
            "runtime": movie.runtime,
            "vote_average": movie.vote_average,
            "genres": movie.genres or [],
            "ratings_external": movie.ratings_external or {},
            "mood_tags": movie.mood_tags or [],
            "era_tag": movie.era_tag,
        },
        "score": rec.score,
        "rank": rec.rank,
        "per_scorer": rec.per_scorer,
        "explanation": rec.explanation,
        "library": libs.get(movie.id, {"in_library": False}),
    }
