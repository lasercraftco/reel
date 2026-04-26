"""Pydantic request / response schemas."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    ok: bool = True
    service: str = "reel-engine"
    version: str
    db: bool = True


class MovieSummary(BaseModel):
    id: int
    title: str
    release_date: str | None = None
    poster_path: str | None = None
    backdrop_path: str | None = None
    overview: str | None = None
    runtime: int | None = None
    vote_average: float | None = None
    genres: list[dict[str, Any]] = Field(default_factory=list)


class MovieDetail(MovieSummary):
    original_title: str | None = None
    original_language: str | None = None
    tagline: str | None = None
    keywords: list[dict[str, Any]] = Field(default_factory=list)
    certification: str | None = None
    cast: list[dict[str, Any]] = Field(default_factory=list)
    crew: list[dict[str, Any]] = Field(default_factory=list)
    ratings_external: dict[str, Any] = Field(default_factory=dict)
    watch_providers: dict[str, Any] = Field(default_factory=dict)
    awards: list[dict[str, Any]] = Field(default_factory=list)
    mood_tags: list[str] = Field(default_factory=list)
    era_tag: str | None = None
    homepage: str | None = None
    imdb_id: str | None = None
    library_status: str | None = None
    plex_key: str | None = None


class RecommendationResponse(BaseModel):
    movie: MovieDetail
    score: float
    rank: int
    per_scorer: dict[str, float] = Field(default_factory=dict)
    explanation: dict[str, Any] = Field(default_factory=dict)


class ForYouRequest(BaseModel):
    user_id: str
    mode: str = "foryou"
    limit: int = 60
    deep_think: bool = False
    filters: dict[str, Any] = Field(default_factory=dict)


class SeedRequest(BaseModel):
    user_id: str
    seed_movie_id: int
    limit: int = 60


class SearchRequest(BaseModel):
    query: str
    limit: int = 20


class FeedbackRequest(BaseModel):
    user_id: str
    movie_id: int
    signal: str  # up | down | block | not_interested | seed
    weight: float = 1.0


class WatchlistAdd(BaseModel):
    user_id: str
    movie_id: int
    note: str | None = None


class AddRequest(BaseModel):
    user_id: str
    movie_id: int
    quality_profile_id: int | None = None
    note: str | None = None


class AddDecision(BaseModel):
    add_id: int
    decision: str  # approved | rejected
    actor_user_id: str
    quality_profile_id: int | None = None


class WatchPartyRequest(BaseModel):
    user_id: str
    runtime_max_minutes: int | None = None
    mood: str | None = None
    family_friendly: bool = False
    exclude_seen: bool = True
    seed_movie_ids: list[int] = Field(default_factory=list)
    n: int = 3


class DailyPickResponse(BaseModel):
    user_id: str
    movie: MovieDetail
    reason: str
