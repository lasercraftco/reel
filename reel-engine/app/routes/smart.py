"""Smart features — watch party, hidden gems, comfort, daily pick, discovery weekly,
director retrospective, plot-keyword explore, surprise me."""

from __future__ import annotations

import random
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import TyflixUser, get_current_user
from app.db import get_session
from app.models import Library, Movie, Recommendation
from app.schemas import WatchPartyRequest
from app.services.recommender import recompute
from app.sources import tmdb

router = APIRouter(prefix="/api/smart", tags=["smart"])


@router.post("/watchparty")
async def watch_party(
    body: WatchPartyRequest,
    session: AsyncSession = Depends(get_session),
    user: TyflixUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    scored = await recompute(
        session,
        user_id=user.id,
        mode="watchparty",
        seed_movie_id=body.seed_movie_ids[0] if body.seed_movie_ids else None,
        limit=80,
        deep_think=False,
        filters={"familyFriendly": body.family_friendly},
    )
    pool = [
        s
        for s in scored
        if (not body.runtime_max_minutes or (s["candidate"].get("runtime") or 999) <= body.runtime_max_minutes)
    ]
    if body.mood:
        pool = [s for s in pool if body.mood.lower() in (s["candidate"].get("mood_tags") or [])]
    return [{"movie": s["candidate"], "score": s["score"], "explanation": s["explanation"]} for s in pool[: body.n]]


@router.get("/hidden-gems")
async def hidden_gems(
    session: AsyncSession = Depends(get_session),
    user: TyflixUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    scored = await recompute(session, user_id=user.id, mode="hidden_gems", limit=80)
    # Bias to high vote_average / low popularity
    filtered = [
        s for s in scored
        if (s["candidate"].get("vote_average") or 0) >= 7.2
        and (s["candidate"].get("popularity") or 100) < 30
    ]
    return [{"movie": s["candidate"], "score": s["score"]} for s in filtered[:30]]


@router.get("/comfort")
async def comfort(
    session: AsyncSession = Depends(get_session),
    user: TyflixUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    rows = (
        await session.execute(
            select(Movie)
            .join(Library, Library.movie_id == Movie.id)
            .where(Movie.vote_average >= 7.0)
            .order_by(desc(Movie.vote_average))
            .limit(30)
        )
    ).scalars().all()
    return [
        {
            "movie": {
                "id": m.id,
                "title": m.title,
                "poster_path": m.poster_path,
                "vote_average": m.vote_average,
                "release_date": m.release_date,
                "genres": m.genres or [],
            }
        }
        for m in rows
    ]


@router.get("/daily-pick")
async def daily_pick(
    session: AsyncSession = Depends(get_session),
    user: TyflixUser = Depends(get_current_user),
) -> dict[str, Any]:
    today = datetime.utcnow().date().isoformat()
    rng = random.Random(f"{user.id}:{today}")
    rec_rows = (
        await session.execute(
            select(Recommendation, Movie)
            .join(Movie, Recommendation.movie_id == Movie.id)
            .where(Recommendation.user_id == user.id, Recommendation.mode == "foryou")
            .order_by(Recommendation.rank.asc())
            .limit(40)
        )
    ).all()
    if not rec_rows:
        scored = await recompute(session, user_id=user.id, mode="foryou", limit=40, deep_think=True)
        if not scored:
            raise HTTPException(404, "nothing_today")
        pick = rng.choice(scored)
        cand = pick["candidate"]
        return {"movie": cand, "reason": pick["explanation"].get("reason") or "Today's pick"}
    pick_row = rng.choice(rec_rows)
    rec, movie = pick_row
    return {
        "movie": {
            "id": movie.id,
            "title": movie.title,
            "poster_path": movie.poster_path,
            "backdrop_path": movie.backdrop_path,
            "release_date": movie.release_date,
            "overview": movie.overview,
            "runtime": movie.runtime,
            "vote_average": movie.vote_average,
        },
        "reason": (rec.explanation or {}).get("reason") or "From your top recs",
    }


@router.get("/discovery-weekly")
async def discovery_weekly(
    session: AsyncSession = Depends(get_session),
    user: TyflixUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    scored = await recompute(session, user_id=user.id, mode="foryou", limit=30, deep_think=True)
    return [{"movie": s["candidate"], "score": s["score"], "reason": s["explanation"].get("reason")} for s in scored]


@router.get("/director/{person_id}")
async def director_retrospective(person_id: int) -> list[dict[str, Any]]:
    data = await tmdb.credits_for_person(person_id)
    crew = data.get("crew") or []
    directorial = [c for c in crew if c.get("job") == "Director"]
    directorial.sort(key=lambda c: (c.get("vote_average") or 0), reverse=True)
    return directorial


@router.get("/keyword/{keyword_id}")
async def explore_keyword(keyword_id: int) -> list[dict[str, Any]]:
    return await tmdb.discover(with_keywords=str(keyword_id), sort_by="vote_average.desc", **{"vote_count.gte": 100})


@router.get("/surprise")
async def surprise(
    session: AsyncSession = Depends(get_session),
    user: TyflixUser = Depends(get_current_user),
) -> dict[str, Any]:
    rows = (
        await session.execute(
            select(Recommendation, Movie)
            .join(Movie, Recommendation.movie_id == Movie.id)
            .where(Recommendation.user_id == user.id, Recommendation.mode == "foryou")
            .order_by(Recommendation.rank.asc())
            .limit(100)
        )
    ).all()
    if not rows:
        raise HTTPException(404, "no_recommendations_yet")
    rec, movie = random.choice(rows)
    return {
        "movie": {
            "id": movie.id,
            "title": movie.title,
            "poster_path": movie.poster_path,
            "backdrop_path": movie.backdrop_path,
            "release_date": movie.release_date,
            "overview": movie.overview,
            "vote_average": movie.vote_average,
        },
        "reason": (rec.explanation or {}).get("reason") or "Random pick from your top 100",
    }


@router.get("/unwatched-in-library")
async def unwatched_in_library(
    session: AsyncSession = Depends(get_session),
    user: TyflixUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    user.require("owner", "trusted")  # Plex history-derived
    rows = (
        await session.execute(
            select(Movie)
            .join(Library, Library.movie_id == Movie.id)
            .where(Library.status == "imported")
            .order_by(desc(Library.added_at))
            .limit(60)
        )
    ).scalars().all()
    return [
        {"movie": {"id": m.id, "title": m.title, "poster_path": m.poster_path, "release_date": m.release_date}}
        for m in rows
    ]
