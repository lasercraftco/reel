"""Per-user self-service endpoints — friend-safe."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import TyflixUser, get_current_user
from app.db import get_session
from app.models import LibraryAdd, Movie

router = APIRouter(prefix="/api/account", tags=["account"])


@router.get("/requests")
async def my_requests(
    session: AsyncSession = Depends(get_session),
    user: TyflixUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    rows = (
        await session.execute(
            select(LibraryAdd, Movie)
            .join(Movie, LibraryAdd.movie_id == Movie.id)
            .where(LibraryAdd.user_id == user.id)
            .order_by(desc(LibraryAdd.created_at))
            .limit(200)
        )
    ).all()
    return [
        {
            "add_id": a.id,
            "status": a.status,
            "created_at": a.created_at.isoformat(),
            "movie": {
                "id": m.id,
                "title": m.title,
                "poster_path": m.poster_path,
                "release_date": m.release_date,
            },
            "note": a.note,
        }
        for a, m in rows
    ]
