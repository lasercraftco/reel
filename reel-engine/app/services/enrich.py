"""Movie enrichment — TMDB + OMDb + Letterboxd + Wikipedia → upsert into movies."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Movie
from app.sources import letterboxd, omdb, tmdb, wikipedia

log = logging.getLogger(__name__)


def _era_tag(release_date: str | None) -> str | None:
    if not release_date or len(release_date) < 4:
        return None
    try:
        year = int(release_date[:4])
    except ValueError:
        return None
    decade = (year // 10) * 10
    return f"{decade}s"


def _mood_tags(genres: list[dict[str, Any]], keywords: list[dict[str, Any]]) -> list[str]:
    keyword_text = " ".join((k.get("name") or "").lower() for k in keywords)
    genre_names = {(g.get("name") or "").lower() for g in genres}
    out: set[str] = set()
    if any(g in genre_names for g in ("horror", "thriller")):
        out.add("midnight movie")
    if "drama" in genre_names and any(t in keyword_text for t in ("grief", "memory", "loss")):
        out.add("tearjerker")
    if "comedy" in genre_names and "family" in genre_names:
        out.add("comfort")
    if any(t in keyword_text for t in ("psychological", "mind", "memory", "twist")):
        out.add("mind-bender")
    if "romance" in genre_names:
        out.add("date night")
    if any(t in keyword_text for t in ("kid", "children", "family", "animated")):
        out.add("kid-friendly")
    if any(t in keyword_text for t in ("oscar", "academy")):
        out.add("awards bait")
    return sorted(out)


async def enrich_movie(session: AsyncSession, tmdb_id: int) -> Movie | None:
    tdata = await tmdb.movie(tmdb_id, session=session)
    if not tdata:
        return None

    imdb_id = (tdata.get("external_ids") or {}).get("imdb_id") or tdata.get("imdb_id")
    omdb_data: dict[str, Any] = {}
    if imdb_id:
        omdb_data = await omdb.by_imdb(imdb_id) or {}

    cert = _extract_certification(tdata.get("release_dates", {}))

    cast = (tdata.get("credits") or {}).get("cast") or []
    crew = (tdata.get("credits") or {}).get("crew") or []
    keywords = (tdata.get("keywords") or {}).get("keywords") or []
    genres = tdata.get("genres") or []

    awards: list[dict[str, Any]] = []
    if omdb_data.get("awards"):
        # OMDb gives a free-text "awards" string; we keep it as a single
        # ceremony record with no granularity. Better data could come from
        # a Wikipedia awards-pages scrape down the road.
        awards.append({
            "ceremony": "academy" if "Oscar" in omdb_data["awards"] else "other",
            "year": int((tdata.get("release_date") or "0000")[:4]) or 0,
            "category": omdb_data["awards"],
            "result": "won" if "Won" in omdb_data["awards"] else "nominated",
        })

    # Letterboxd avg rating (best-effort)
    lb_rating = None
    try:
        lb_rating = await letterboxd.average_rating(
            title=tdata.get("title", ""),
            year=(tdata.get("release_date") or "")[:4] or None,
            session=session,
        )
    except Exception as exc:  # noqa: BLE001
        log.debug("letterboxd rating failed for %s: %s", tmdb_id, exc)

    ratings_external = {
        **({"imdb": omdb_data.get("ratings", {}).get("imdb")} if omdb_data else {}),
        **({"rt": omdb_data.get("ratings", {}).get("rt")} if omdb_data else {}),
        **({"mc": omdb_data.get("ratings", {}).get("mc")} if omdb_data else {}),
        **({"letterboxd": lb_rating} if lb_rating else {}),
    }

    payload: dict[str, Any] = {
        "id": tmdb_id,
        "imdb_id": imdb_id,
        "title": tdata.get("title", ""),
        "original_title": tdata.get("original_title"),
        "overview": tdata.get("overview"),
        "tagline": tdata.get("tagline"),
        "release_date": tdata.get("release_date"),
        "runtime": tdata.get("runtime"),
        "poster_path": tdata.get("poster_path"),
        "backdrop_path": tdata.get("backdrop_path"),
        "original_language": tdata.get("original_language"),
        "spoken_languages": [s.get("iso_639_1") for s in tdata.get("spoken_languages", []) if s.get("iso_639_1")],
        "production_countries": [c.get("iso_3166_1") for c in tdata.get("production_countries", []) if c.get("iso_3166_1")],
        "genres": genres,
        "keywords": keywords,
        "certification": cert,
        "vote_average": tdata.get("vote_average"),
        "vote_count": tdata.get("vote_count"),
        "popularity": tdata.get("popularity"),
        "budget": tdata.get("budget"),
        "revenue": tdata.get("revenue"),
        "status": tdata.get("status"),
        "homepage": tdata.get("homepage"),
        "collection_id": (tdata.get("belongs_to_collection") or {}).get("id"),
        "collection_name": (tdata.get("belongs_to_collection") or {}).get("name"),
        "cast": [
            {"id": c["id"], "name": c["name"], "character": c.get("character"), "profilePath": c.get("profile_path"), "order": c.get("order")}
            for c in cast[:20]
            if c.get("id") and c.get("name")
        ],
        "crew": [
            {"id": c["id"], "name": c["name"], "job": c.get("job"), "department": c.get("department"), "profilePath": c.get("profile_path")}
            for c in crew
            if c.get("id") and c.get("name") and c.get("job") in {"Director", "Writer", "Director of Photography", "Original Music Composer", "Producer", "Screenplay"}
        ],
        "ratings_external": ratings_external,
        "watch_providers": tdata.get("watch/providers") or {},
        "awards": awards,
        "mood_tags": _mood_tags(genres, keywords),
        "era_tag": _era_tag(tdata.get("release_date")),
        "enriched_at": datetime.utcnow(),
    }

    stmt = pg_insert(Movie).values(**payload)
    stmt = stmt.on_conflict_do_update(index_elements=[Movie.id], set_={k: v for k, v in payload.items() if k != "id"})
    await session.execute(stmt)
    await session.flush()
    row = (await session.execute(select(Movie).where(Movie.id == tmdb_id))).scalar_one()

    # Cache wiki plot in source_cache (used later by plot embedding)
    try:
        await wikipedia.plot(
            title=row.title,
            year=(row.release_date or "")[:4] or None,
            session=session,
        )
    except Exception as exc:  # noqa: BLE001
        log.debug("wiki plot enrichment skipped: %s", exc)

    await session.commit()
    return row


def _extract_certification(release_dates: dict[str, Any]) -> str | None:
    for entry in release_dates.get("results") or []:
        if entry.get("iso_3166_1") == "US":
            for rd in entry.get("release_dates") or []:
                if rd.get("certification"):
                    return str(rd["certification"])
    return None
