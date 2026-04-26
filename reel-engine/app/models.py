"""SQLAlchemy ORM models — mirrors the Drizzle schema in reel-web/src/lib/db/schema.ts."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True)
    name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(800), nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="friend")
    blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    onboarded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    daily_request_quota: Mapped[int] = mapped_column(Integer, default=5)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    settings: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)


class Movie(Base):
    __tablename__ = "movies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)  # TMDB id
    imdb_id: Mapped[str | None] = mapped_column(String(20), nullable=True)
    title: Mapped[str] = mapped_column(String(400))
    original_title: Mapped[str | None] = mapped_column(String(400), nullable=True)
    overview: Mapped[str | None] = mapped_column(Text, nullable=True)
    tagline: Mapped[str | None] = mapped_column(Text, nullable=True)
    release_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    runtime: Mapped[int | None] = mapped_column(Integer, nullable=True)
    poster_path: Mapped[str | None] = mapped_column(String(200), nullable=True)
    backdrop_path: Mapped[str | None] = mapped_column(String(200), nullable=True)
    original_language: Mapped[str | None] = mapped_column(String(10), nullable=True)
    spoken_languages: Mapped[list[str]] = mapped_column(JSONB, default=list)
    production_countries: Mapped[list[str]] = mapped_column(JSONB, default=list)
    genres: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    keywords: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    certification: Mapped[str | None] = mapped_column(String(12), nullable=True)
    vote_average: Mapped[float | None] = mapped_column(Float, nullable=True)
    vote_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    popularity: Mapped[float | None] = mapped_column(Float, nullable=True)
    budget: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    revenue: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    homepage: Mapped[str | None] = mapped_column(String(800), nullable=True)
    collection_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    collection_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    cast: Mapped[list[dict[str, Any]]] = mapped_column("cast", JSONB, default=list)
    crew: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    ratings_external: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    watch_providers: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    awards: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    mood_tags: Mapped[list[str]] = mapped_column(JSONB, default=list)
    era_tag: Mapped[str | None] = mapped_column(String(60), nullable=True)
    embedding: Mapped[list[float] | None] = mapped_column(JSONB, nullable=True)
    enriched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Library(Base):
    __tablename__ = "library"

    movie_id: Mapped[int] = mapped_column(Integer, ForeignKey("movies.id", ondelete="CASCADE"), primary_key=True)
    radarr_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    quality_profile_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(30))
    progress_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    size_on_disk: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    monitored: Mapped[bool] = mapped_column(Boolean, default=True)
    plex_key: Mapped[str | None] = mapped_column(String(80), nullable=True)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Watchlist(Base):
    __tablename__ = "watchlist"

    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    movie_id: Mapped[int] = mapped_column(Integer, ForeignKey("movies.id", ondelete="CASCADE"), primary_key=True)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"))
    movie_id: Mapped[int] = mapped_column(Integer, ForeignKey("movies.id", ondelete="CASCADE"))
    signal: Mapped[str] = mapped_column(String(20))
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class LibraryAdd(Base):
    __tablename__ = "library_adds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"))
    movie_id: Mapped[int] = mapped_column(Integer, ForeignKey("movies.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(20))
    quality_profile_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    decision_by: Mapped[str | None] = mapped_column(UUID(as_uuid=False), nullable=True)
    decision_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class SearchHistory(Base):
    __tablename__ = "search_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"))
    query: Mapped[str] = mapped_column(String(400))
    result_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class ViewHistory(Base):
    __tablename__ = "view_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"))
    movie_id: Mapped[int] = mapped_column(Integer, ForeignKey("movies.id", ondelete="CASCADE"))
    surface: Mapped[str] = mapped_column(String(30))
    session_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"))
    movie_id: Mapped[int] = mapped_column(Integer, ForeignKey("movies.id", ondelete="CASCADE"))
    mode: Mapped[str] = mapped_column(String(30))
    seed_key: Mapped[str | None] = mapped_column(String(200), nullable=True)
    score: Mapped[float] = mapped_column(Float)
    per_scorer: Mapped[dict[str, float]] = mapped_column(JSONB, default=dict)
    explanation: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    rank: Mapped[int] = mapped_column(Integer)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SourceCache(Base):
    __tablename__ = "source_cache"

    source: Mapped[str] = mapped_column(String(30), primary_key=True)
    key: Mapped[str] = mapped_column(String(400), primary_key=True)
    payload: Mapped[Any] = mapped_column(JSONB)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PlexHistory(Base):
    __tablename__ = "plex_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    movie_id: Mapped[int] = mapped_column(Integer, ForeignKey("movies.id", ondelete="CASCADE"))
    plex_key: Mapped[str | None] = mapped_column(String(80), nullable=True)
    viewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), nullable=True)
    action: Mapped[str] = mapped_column(String(40))
    target: Mapped[str | None] = mapped_column(String(200), nullable=True)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
