"""Centralized settings — reads from env, validates with pydantic."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = Field(default="postgres://reel:reel@localhost:5432/reel")

    # Auth (must match reel-web for SSO)
    tyflix_auth_jwt_secret: str = "dev-only-do-not-use-in-prod"
    tyflix_auth_jwt_issuer: str = "tyflix.net"
    tyflix_owner_email: str = "tylerheon@gmail.com"

    # Discovery sources
    tmdb_api_key: str = ""
    tmdb_read_token: str = ""
    omdb_api_key: str = ""
    trakt_client_id: str = ""
    trakt_client_secret: str = ""
    trakt_access_token: str = ""
    letterboxd_user: str = ""
    anthropic_api_key: str = ""

    # Library wire
    radarr_url: str = "http://host.docker.internal:7878"
    radarr_api_key: str = ""
    plex_url: str = "http://host.docker.internal:32400"
    plex_token: str = ""
    plex_machine_id: str = ""

    # Tuning defaults — sum will be normalized at scoring time
    reel_default_content_weight: float = 0.18
    reel_default_plot_weight: float = 0.10
    reel_default_collab_weight: float = 0.14
    reel_default_letterboxd_weight: float = 0.14
    reel_default_tmdb_similar_weight: float = 0.10
    reel_default_crew_weight: float = 0.10
    reel_default_critic_weight: float = 0.06
    reel_default_awards_weight: float = 0.04
    reel_default_reddit_weight: float = 0.04
    reel_default_llm_weight: float = 0.05
    reel_default_item2vec_weight: float = 0.05
    reel_exploration_ratio: float = 0.08
    reel_candidate_pool_size: int = 400

    # Caches
    tmdb_cache_ttl_seconds: int = 86400
    letterboxd_scrape_delay_ms: int = 750
    http_user_agent: str = "Reel/1.0 (reel.tyflix.net)"

    # Friend quotas
    reel_friend_daily_request_quota: int = 5
    reel_friend_auto_approve: bool = False

    # General
    log_level: str = "info"


@lru_cache
def get_settings() -> Settings:
    return Settings()
