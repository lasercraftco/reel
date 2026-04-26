"""Per-user thumb-up/down + block + view-history endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import TyflixUser, get_current_user
from app.db import get_session
from app.models import Feedback, ViewHistory
from app.schemas import FeedbackRequest

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


@router.post("")
async def submit(
    body: FeedbackRequest,
    session: AsyncSession = Depends(get_session),
    user: TyflixUser = Depends(get_current_user),
) -> dict[str, Any]:
    if body.signal not in {"up", "down", "block", "not_interested", "seed"}:
        raise HTTPException(400, "invalid_signal")
    session.add(
        Feedback(
            user_id=user.id,
            movie_id=body.movie_id,
            signal=body.signal,
            weight=body.weight,
            created_at=datetime.utcnow(),
        )
    )
    await session.commit()
    return {"ok": True}


@router.post("/view")
async def view(
    body: dict[str, Any],
    session: AsyncSession = Depends(get_session),
    user: TyflixUser = Depends(get_current_user),
) -> dict[str, Any]:
    movie_id = int(body.get("movie_id", 0))
    surface = str(body.get("surface", "foryou"))
    session_id = body.get("session_id")
    if not movie_id:
        raise HTTPException(400, "missing_movie_id")
    session.add(
        ViewHistory(
            user_id=user.id,
            movie_id=movie_id,
            surface=surface,
            session_id=session_id,
            created_at=datetime.utcnow(),
        )
    )
    await session.commit()
    return {"ok": True}
