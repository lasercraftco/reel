"""Library scan + Radarr add endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import TyflixUser, get_current_user
from app.config import get_settings
from app.db import get_session
from app.models import AuditLog, Library, LibraryAdd, Movie, User
from app.schemas import AddDecision, AddRequest
from app.services.library_scan import attach_plex_keys, scan_plex, scan_radarr
from app.sources import plex, radarr

router = APIRouter(prefix="/api/library", tags=["library"])


@router.post("/scan")
async def scan(session: AsyncSession = Depends(get_session)) -> dict[str, Any]:
    radarr_summary = await scan_radarr(session)
    plex_attached = 0
    plex_summary: dict[str, int] = {"sections": 0, "history_rows": 0}
    try:
        plex_attached = await attach_plex_keys(session)
        plex_summary = await scan_plex(session)
    except Exception as exc:  # noqa: BLE001
        plex_summary = {"sections": 0, "history_rows": 0, "error": str(exc)}  # type: ignore[dict-item]
    return {"radarr": radarr_summary, "plex": plex_summary, "plex_keys_attached": plex_attached}


@router.get("/state/{movie_id}")
async def state(movie_id: int, session: AsyncSession = Depends(get_session)) -> dict[str, Any]:
    row = (await session.execute(select(Library).where(Library.movie_id == movie_id))).scalar_one_or_none()
    if not row:
        return {"movie_id": movie_id, "in_library": False}
    return {
        "movie_id": movie_id,
        "in_library": row.status in {"imported", "downloaded"},
        "status": row.status,
        "progress": row.progress_percent,
        "size_on_disk": row.size_on_disk,
        "plex_key": row.plex_key,
        "plex_link": plex.web_deep_link(row.plex_key) if row.plex_key else None,
    }


@router.get("/quality-profiles")
async def quality_profiles(user: TyflixUser = Depends(get_current_user)) -> list[dict[str, Any]]:
    user.require("owner", "trusted")
    return await radarr.list_quality_profiles()


@router.post("/add")
async def request_add(
    body: AddRequest,
    session: AsyncSession = Depends(get_session),
    user: TyflixUser = Depends(get_current_user),
) -> dict[str, Any]:
    if body.user_id != user.id:
        raise HTTPException(403, "user_mismatch")
    me = (await session.execute(select(User).where(User.id == user.id))).scalar_one()
    movie = (await session.execute(select(Movie).where(Movie.id == body.movie_id))).scalar_one_or_none()
    if not movie:
        raise HTTPException(404, "movie_not_found")
    auto_approve = user.role in {"owner", "trusted"} or get_settings().reel_friend_auto_approve
    add = LibraryAdd(
        user_id=user.id,
        movie_id=body.movie_id,
        status="approved" if auto_approve else "requested",
        quality_profile_id=body.quality_profile_id,
        note=body.note,
        decision_by=user.id if auto_approve else None,
    )
    session.add(add)

    submitted_payload: dict[str, Any] | None = None
    if auto_approve:
        try:
            submitted_payload = await _submit_to_radarr(movie, body.quality_profile_id)
            add.status = "submitted"
        except Exception as exc:  # noqa: BLE001
            add.status = "failed"
            session.add(
                AuditLog(
                    user_id=user.id,
                    action="library.submit_failed",
                    target=str(movie.id),
                    metadata_={"error": str(exc)},
                )
            )

    session.add(
        AuditLog(
            user_id=user.id,
            action="library.add" if auto_approve else "library.request",
            target=str(movie.id),
            metadata_={"title": movie.title, "auto_approve": auto_approve},
        )
    )
    await session.commit()
    return {"add_id": add.id, "status": add.status, "radarr": submitted_payload}


@router.post("/decision")
async def decision(
    body: AddDecision,
    session: AsyncSession = Depends(get_session),
    user: TyflixUser = Depends(get_current_user),
) -> dict[str, Any]:
    user.require("owner")
    add = (await session.execute(select(LibraryAdd).where(LibraryAdd.id == body.add_id))).scalar_one_or_none()
    if not add:
        raise HTTPException(404, "request_not_found")
    movie = (await session.execute(select(Movie).where(Movie.id == add.movie_id))).scalar_one()
    add.decision_by = user.id
    if body.decision == "approved":
        add.status = "approved"
        try:
            await _submit_to_radarr(movie, body.quality_profile_id or add.quality_profile_id)
            add.status = "submitted"
        except Exception as exc:  # noqa: BLE001
            add.status = "failed"
            session.add(
                AuditLog(
                    user_id=user.id,
                    action="library.decision_submit_failed",
                    target=str(movie.id),
                    metadata_={"error": str(exc)},
                )
            )
    else:
        add.status = "rejected"
    session.add(
        AuditLog(
            user_id=user.id,
            action=f"library.decision.{body.decision}",
            target=str(movie.id),
            metadata_={"add_id": add.id},
        )
    )
    await session.commit()
    return {"add_id": add.id, "status": add.status}


async def _submit_to_radarr(movie: Movie, quality_profile_id: int | None) -> dict[str, Any]:
    profiles = await radarr.list_quality_profiles()
    if not profiles:
        raise RuntimeError("radarr has no quality profiles")
    qp = quality_profile_id or profiles[0]["id"]
    folder = await radarr.root_folder()
    if not folder:
        raise RuntimeError("radarr has no root folders")
    return await radarr.add_movie(
        tmdb_id=movie.id, quality_profile_id=qp, root_folder_path=folder, monitored=True, search=True
    )


@router.get("/queue")
async def queue() -> list[dict[str, Any]]:
    return await radarr.queue()


@router.get("/now-playing")
async def now_playing(user: TyflixUser = Depends(get_current_user)) -> list[dict[str, Any]]:
    user.require("owner", "trusted")  # Plex history is sensitive — don't expose to friends
    return await plex.now_playing()
