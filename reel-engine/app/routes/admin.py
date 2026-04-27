"""Admin endpoints — owner-only."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import TyflixUser, get_current_user
from app.db import get_session
from app.models import AuditLog, LibraryAdd, Movie, User

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users")
async def users(
    session: AsyncSession = Depends(get_session),
    user: TyflixUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    user.require("owner")
    rows = (await session.execute(select(User).order_by(User.created_at.asc()))).scalars().all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "role": u.role,
            "blocked": u.blocked,
            "daily_quota": u.daily_request_quota,
            "created_at": u.created_at.isoformat(),
            "last_seen_at": u.last_seen_at.isoformat() if u.last_seen_at else None,
        }
        for u in rows
    ]


@router.post("/users/{user_id}")
async def update_user(
    user_id: str,
    body: dict[str, Any],
    session: AsyncSession = Depends(get_session),
    user: TyflixUser = Depends(get_current_user),
) -> dict[str, Any]:
    user.require("owner")
    target = (await session.execute(select(User).where(User.id == user_id))).scalar_one()
    if "role" in body and body["role"] in {"owner", "trusted", "friend", "guest"}:
        target.role = body["role"]
    if "blocked" in body:
        target.blocked = bool(body["blocked"])
    if "daily_request_quota" in body:
        target.daily_request_quota = int(body["daily_request_quota"])
    if "settings" in body and isinstance(body["settings"], dict):
        target.settings = {**(target.settings or {}), **body["settings"]}
    session.add(
        AuditLog(
            user_id=user.id,
            action="admin.update_user",
            target=user_id,
            metadata_={k: body.get(k) for k in ("role", "blocked", "daily_request_quota", "settings") if k in body},
        )
    )
    await session.commit()
    return {"ok": True}


@router.patch("/users/{user_id}/quota")
async def update_user_quota(
    user_id: str,
    body: dict[str, Any],
    session: AsyncSession = Depends(get_session),
    user: TyflixUser = Depends(get_current_user),
) -> dict[str, Any]:
    user.require("owner")
    target = (await session.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(404, "user_not_found")
    if "daily_request_quota" in body:
        target.daily_request_quota = int(body["daily_request_quota"])
    session.add(
        AuditLog(
            user_id=user.id,
            action="admin.update_quota",
            target=user_id,
            metadata_={"daily_request_quota": target.daily_request_quota},
        )
    )
    await session.commit()
    return {
        "id": target.id,
        "email": target.email,
        "role": target.role,
        "daily_request_quota": target.daily_request_quota,
    }


@router.get("/requests")
async def requests(
    session: AsyncSession = Depends(get_session),
    user: TyflixUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    user.require("owner")
    rows = (
        await session.execute(
            select(LibraryAdd, Movie, User)
            .join(Movie, LibraryAdd.movie_id == Movie.id)
            .join(User, LibraryAdd.user_id == User.id)
            .order_by(desc(LibraryAdd.created_at))
            .limit(200)
        )
    ).all()
    return [
        {
            "add_id": a.id,
            "status": a.status,
            "created_at": a.created_at.isoformat(),
            "user": {"id": u.id, "email": u.email, "role": u.role},
            "movie": {"id": m.id, "title": m.title, "poster_path": m.poster_path, "release_date": m.release_date},
            "note": a.note,
        }
        for a, m, u in rows
    ]


@router.get("/audit")
async def audit(
    limit: int = 200,
    session: AsyncSession = Depends(get_session),
    user: TyflixUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    user.require("owner")
    rows = (
        await session.execute(select(AuditLog).order_by(desc(AuditLog.created_at)).limit(limit))
    ).scalars().all()
    return [
        {
            "id": a.id,
            "user_id": a.user_id,
            "action": a.action,
            "target": a.target,
            "metadata": a.metadata_,
            "created_at": a.created_at.isoformat(),
        }
        for a in rows
    ]


@router.get("/settings")
async def get_settings_view(
    user: TyflixUser = Depends(get_current_user),
) -> dict[str, Any]:
    user.require("owner")
    from app.config import get_settings as gs

    s = gs()
    return {
        "engine_version": "0.1.0",
        "candidate_pool_size": s.reel_candidate_pool_size,
        "exploration_ratio": s.reel_exploration_ratio,
        "friend_daily_quota": s.reel_friend_daily_request_quota,
        "friend_auto_approve": s.reel_friend_auto_approve,
        "weights_default": {
            "content": s.reel_default_content_weight,
            "plot_embedding": s.reel_default_plot_weight,
            "collaborative": s.reel_default_collab_weight,
            "letterboxd": s.reel_default_letterboxd_weight,
            "tmdb_similar": s.reel_default_tmdb_similar_weight,
            "crew": s.reel_default_crew_weight,
            "critic": s.reel_default_critic_weight,
            "awards": s.reel_default_awards_weight,
            "reddit": s.reel_default_reddit_weight,
            "llm": s.reel_default_llm_weight,
            "item2vec": s.reel_default_item2vec_weight,
        },
    }
