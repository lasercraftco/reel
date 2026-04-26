"""Shared httpx helpers + Postgres-backed cache."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential_jitter

from app.config import get_settings
from app.models import SourceCache

log = logging.getLogger(__name__)

_DEFAULT_TIMEOUT = httpx.Timeout(connect=10, read=20, write=10, pool=20)
_client: httpx.AsyncClient | None = None


def client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        s = get_settings()
        _client = httpx.AsyncClient(
            timeout=_DEFAULT_TIMEOUT,
            headers={"User-Agent": s.http_user_agent},
            follow_redirects=True,
        )
    return _client


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential_jitter(initial=0.4, max=4.0),
    retry=retry_if_exception_type((httpx.HTTPError,)),
    reraise=True,
)
async def get_json(url: str, *, params: dict[str, Any] | None = None, headers: dict[str, str] | None = None) -> Any:
    r = await client().get(url, params=params, headers=headers)
    r.raise_for_status()
    return r.json()


@retry(
    stop=stop_after_attempt(2),
    wait=wait_exponential_jitter(initial=0.4, max=2.0),
    retry=retry_if_exception_type((httpx.HTTPError,)),
    reraise=True,
)
async def get_text(url: str, *, params: dict[str, Any] | None = None, headers: dict[str, str] | None = None) -> str:
    r = await client().get(url, params=params, headers=headers)
    r.raise_for_status()
    return r.text


_LB_LOCK = asyncio.Lock()


async def letterboxd_get(url: str) -> str:
    """Politely-rate-limited GET for Letterboxd scraping."""
    s = get_settings()
    async with _LB_LOCK:
        text = await get_text(url)
        await asyncio.sleep(s.letterboxd_scrape_delay_ms / 1000.0)
        return text


async def cache_get(session: AsyncSession, source: str, key: str) -> Any | None:
    row = (
        await session.execute(
            select(SourceCache).where(SourceCache.source == source, SourceCache.key == key)
        )
    ).scalar_one_or_none()
    if not row:
        return None
    if row.expires_at and row.expires_at < datetime.utcnow():
        return None
    return row.payload


async def cache_set(
    session: AsyncSession, source: str, key: str, payload: Any, *, ttl_seconds: int | None = None
) -> None:
    expires = datetime.utcnow() + timedelta(seconds=ttl_seconds) if ttl_seconds else None
    stmt = pg_insert(SourceCache).values(
        source=source, key=key, payload=payload, fetched_at=datetime.utcnow(), expires_at=expires
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[SourceCache.source, SourceCache.key],
        set_={"payload": payload, "fetched_at": datetime.utcnow(), "expires_at": expires},
    )
    await session.execute(stmt)
    await session.commit()
