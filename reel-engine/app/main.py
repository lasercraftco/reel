"""FastAPI entrypoint."""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.config import get_settings
from app.routes import (
    account,
    admin,
    feedback,
    health,
    integrations,
    library,
    movies,
    recommend,
    search,
    smart,
    watchlist,
)

logging.basicConfig(level=getattr(logging, get_settings().log_level.upper(), logging.INFO))


app = FastAPI(
    title="Reel — engine",
    version=__version__,
    description="Self-hosted movie discovery (recommendation ensemble + Radarr/Plex/TMDB integration).",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(library.router)
app.include_router(movies.router)
app.include_router(search.router)
app.include_router(recommend.router)
app.include_router(feedback.router)
app.include_router(watchlist.router)
app.include_router(smart.router)
app.include_router(admin.router)
app.include_router(integrations.router)
app.include_router(account.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "service": "reel-engine",
        "version": __version__,
        "docs": "/docs",
    }
