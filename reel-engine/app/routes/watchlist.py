"""Per-user watchlist endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import TyflixUser, get_current_user
from app.db import get_session
from app.models import Library, Movie, Watchlist
from app.schemas import WatchlistAdd
from app.sources import plex

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


@router.get("")
async def list_(
    session: AsyncSession = Depends(get_session),
    user: TyflixUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    rows = (
        await session.execute(
            select(Watchlist, Movie)
            .join(Movie, Watchlist.movie_id == Movie.id)
            .where(Watchlist.user_id == user.id)
            .order_by(Watchlist.added_at.desc())
        )
    ).all()
    libs = {
        l.movie_id: l for l in (
            await session.execute(
                select(Library).where(Library.movie_id.in_([m.id for _w, m in rows]))
            )
        ).scalars().all()
    }
    out: list[dict[str, Any]] = []
    for w, m in rows:
        lib = libs.get(m.id)
        out.append(
            {
                "movie": {
                    "id": m.id,
                    "title": m.title,
                    "release_date": m.release_date,
                    "poster_path": m.poster_path,
                    "runtime": m.runtime,
                    "vote_average": m.vote_average,
                    "genres": m.genres or [],
                },
                "added_at": w.added_at.isoformat() if w.added_at else None,
                "note": w.note,
                "library": {
                    "in_library": lib.status in {"imported", "downloaded"} if lib else False,
                    "status": lib.status if lib else None,
                    "plex_link": plex.web_deep_link(lib.plex_key) if lib and lib.plex_key else None,
                },
            }
        )
    return out


@router.post("")
async def add(
    body: WatchlistAdd,
    session: AsyncSession = Depends(get_session),
    user: TyflixUser = Depends(get_current_user),
) -> dict[str, Any]:
    stmt = pg_insert(Watchlist).values(user_id=user.id, movie_id=body.movie_id, note=body.note)
    stmt = stmt.on_conflict_do_update(
        index_elements=[Watchlist.user_id, Watchlist.movie_id], set_={"note": body.note}
    )
    await session.execute(stmt)
    await session.commit()
    return {"ok": True}


@router.delete("/{movie_id}")
async def remove(
    movie_id: int,
    session: AsyncSession = Depends(get_session),
    user: TyflixUser = Depends(get_current_user),
) -> dict[str, Any]:
    await session.execute(
        Watchlist.__table__.delete().where(
            (Watchlist.user_id == user.id) & (Watchlist.movie_id == movie_id)
        )
    )
    await session.commit()
    return {"ok": True}
