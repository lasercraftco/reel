"""Search endpoint — debounced TMDB autocomplete."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import TyflixUser, get_current_user
from app.db import get_session
from app.models import SearchHistory
from app.sources import tmdb

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("")
async def search(
    q: str = Query(..., min_length=1),
    limit: int = 12,
    session: AsyncSession = Depends(get_session),
    user: TyflixUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    results = await tmdb.search_movies(q, limit=limit)
    session.add(SearchHistory(user_id=user.id, query=q, result_count=len(results)))
    await session.commit()
    return [
        {
            "id": r.get("id"),
            "title": r.get("title"),
            "release_date": r.get("release_date"),
            "poster_path": r.get("poster_path"),
            "overview": r.get("overview"),
            "vote_average": r.get("vote_average"),
        }
        for r in results
    ]
