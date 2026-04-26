"""Async SQLAlchemy session factory."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings


def _normalize_url(url: str) -> str:
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://") and "+asyncpg" not in url:
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


_engine: Any = None
_factory: async_sessionmaker[AsyncSession] | None = None


def _get_factory() -> async_sessionmaker[AsyncSession]:
    global _engine, _factory
    if _factory is None:
        _engine = create_async_engine(_normalize_url(get_settings().database_url), pool_pre_ping=True)
        _factory = async_sessionmaker(_engine, expire_on_commit=False, class_=AsyncSession)
    return _factory


async def get_session() -> AsyncIterator[AsyncSession]:
    async with _get_factory()() as session:
        yield session
