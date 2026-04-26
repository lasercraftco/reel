"""Recommendation pipeline:

  1. CANDIDATE GENERATION — fan out to TMDB similar/recommendations,
     Letterboxd similar, Trakt related, Reddit, library-aware genre/era
     discover.
  2. ENRICHMENT — ensure each candidate has a full Movie row.
  3. SCORING — run all 11 scorers, combine via per-mode weights.
  4. POST-PROCESS — diversity penalty (no 3-in-a-row same director),
     era balancing, family-friendly / blocked-actor filters, and a 5–10%
     exploration slot.
  5. PERSIST — write top-N to recommendations table for the user/mode.
"""

from __future__ import annotations

import asyncio
import logging
import random
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import scorers as scorer_pkg
from app.config import get_settings
from app.models import Feedback, Library, Movie, PlexHistory, Recommendation, User, ViewHistory, Watchlist
from app.services.enrich import enrich_movie
from app.sources import letterboxd, reddit, tmdb, trakt
from app.sources.llm import deep_rerank, why_this_movie

log = logging.getLogger(__name__)


# ---------- top-level entry ----------


async def recompute(
    session: AsyncSession,
    *,
    user_id: str,
    mode: str = "foryou",
    seed_movie_id: int | None = None,
    limit: int = 60,
    deep_think: bool = False,
    filters: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    user = (await session.execute(select(User).where(User.id == user_id))).scalar_one()
    settings_user = user.settings or {}
    filters = {**(filters or {}), **{k: v for k, v in settings_user.items() if k.startswith("blocked")}}

    library_movie_ids = await _library_ids(session)
    seed_movie = await _resolve_seed(session, seed_movie_id, mode, library_movie_ids)

    candidates = await _gather_candidates(session, seed_movie, mode, library_movie_ids)

    # Filter library, blocked, watched (per mode)
    candidates = _filter_candidates(
        candidates,
        library_movie_ids=library_movie_ids,
        blocked=settings_user,
        family_friendly=bool(settings_user.get("familyFriendly")),
    )

    # Cap pool
    candidates = candidates[: get_settings().reel_candidate_pool_size]

    # Build context (precomputed cross-cutting signals)
    context = await _build_context(session, seed_movie, candidates, user_id=user_id, deep_think=deep_think)

    weights = _resolve_weights(mode, settings_user)
    scored = await _score_all(seed_movie, candidates, context, weights)

    # Diversity & era penalties
    scored = _apply_diversity(scored)
    scored.sort(key=lambda s: s["score"], reverse=True)

    # Surprise quota
    s = get_settings()
    if random.random() < s.reel_exploration_ratio and len(scored) > 30:
        scored = scored[:1] + [random.choice(scored[10:30])] + scored[1:]

    # Persist + decorate
    final: list[dict[str, Any]] = []
    rank = 1
    for s_row in scored[:limit]:
        cand = s_row["candidate"]
        if deep_think and rank <= 5:
            try:
                s_row["explanation"]["reason"] = await why_this_movie(
                    seed_summary=_seed_summary(seed_movie),
                    candidate=cand,
                    signals=s_row["explanation"],
                )
            except Exception:  # noqa: BLE001
                pass
        s_row["rank"] = rank
        final.append(s_row)
        rank += 1

    await _persist(session, user_id=user_id, mode=mode, seed_key=str(seed_movie_id) if seed_movie_id else None, scored=final)
    return final


# ---------- library ----------


async def _library_ids(session: AsyncSession) -> set[int]:
    rows = await session.execute(select(Library.movie_id))
    return {r[0] for r in rows.all()}


async def _resolve_seed(
    session: AsyncSession,
    seed_movie_id: int | None,
    mode: str,
    library_ids: set[int],
) -> dict[str, Any]:
    if seed_movie_id:
        await enrich_movie(session, seed_movie_id)
        m = (await session.execute(select(Movie).where(Movie.id == seed_movie_id))).scalar_one()
        return _movie_to_dict(m)
    # foryou — synthesize a seed from library + thumbs-up history
    rows = (
        await session.execute(
            select(Movie)
            .join(Library, Library.movie_id == Movie.id)
            .order_by(Library.added_at.desc())
            .limit(50)
        )
    ).scalars().all()
    if not rows:
        # Cold start
        return {"id": 0, "title": "your taste", "genres": [], "keywords": [], "cast": [], "crew": []}
    return _aggregate_seed(rows)


def _aggregate_seed(rows: list[Movie]) -> dict[str, Any]:
    genres = Counter()
    keywords = Counter()
    cast = Counter()
    crew = Counter()
    for r in rows:
        for g in r.genres or []:
            genres[g.get("id")] += 1
        for k in r.keywords or []:
            keywords[k.get("id")] += 1
        for c in (r.cast or [])[:5]:
            cast[c.get("id")] += 1
        for c in r.crew or []:
            crew[(c.get("id"), c.get("job"))] += 1
    return {
        "id": 0,
        "title": "your library",
        "genres": [{"id": gid} for gid, _ in genres.most_common(10)],
        "keywords": [{"id": kid} for kid, _ in keywords.most_common(20)],
        "cast": [{"id": cid} for cid, _ in cast.most_common(10)],
        "crew": [{"id": cid, "job": job} for (cid, job), _ in crew.most_common(15)],
        "release_date": "",
        "runtime": int(sum(r.runtime or 0 for r in rows) / max(len(rows), 1)) or None,
        "vote_average": sum(r.vote_average or 0 for r in rows) / max(len(rows), 1),
        "popularity": sum(r.popularity or 0 for r in rows) / max(len(rows), 1),
        "original_language": Counter(r.original_language for r in rows if r.original_language).most_common(1)[0][0] if rows else None,
        "_source_movie_ids": [r.id for r in rows[:20]],
    }


# ---------- candidate generation ----------


async def _gather_candidates(
    session: AsyncSession,
    seed: dict[str, Any],
    mode: str,
    library_ids: set[int],
) -> list[dict[str, Any]]:
    tasks: list[asyncio.Task[list[dict[str, Any]]]] = []
    seed_id = seed.get("id") or 0
    if seed_id:
        tasks.append(asyncio.create_task(_tmdb_similar(seed_id)))
        tasks.append(asyncio.create_task(_tmdb_recs(seed_id)))
        tasks.append(asyncio.create_task(_trakt_related(seed_id)))
        tasks.append(asyncio.create_task(_letterboxd_similar(session, seed)))
        tasks.append(asyncio.create_task(_reddit_iyl(session, seed)))
    elif source_ids := seed.get("_source_movie_ids"):
        # foryou: pull TMDB similar/recs for top library movies
        for sid in source_ids[:8]:
            tasks.append(asyncio.create_task(_tmdb_similar(sid)))
            tasks.append(asyncio.create_task(_tmdb_recs(sid)))

    pool: list[dict[str, Any]] = []
    for batch in await asyncio.gather(*tasks, return_exceptions=True):
        if isinstance(batch, Exception):
            log.debug("candidate batch failed: %s", batch)
            continue
        pool.extend(batch)

    # Discover-mode fallback + augmentation: popular in user's preferred genres
    if seed.get("genres") and len(pool) < 40:
        with_genres = ",".join(str(g["id"]) for g in seed["genres"][:5] if g.get("id"))
        try:
            extra = await tmdb.discover(with_genres=with_genres, sort_by="popularity.desc")
            pool.extend(extra)
        except Exception as exc:  # noqa: BLE001
            log.debug("discover fallback failed: %s", exc)

    # Dedup by id
    seen: set[int] = set()
    uniq: list[dict[str, Any]] = []
    for c in pool:
        cid = c.get("id")
        if not cid or cid in seen:
            continue
        seen.add(int(cid))
        uniq.append(c)

    # Ensure each candidate has a full enriched Movie row
    enriched: list[dict[str, Any]] = []
    for c in uniq[:600]:
        cid = int(c["id"])
        existing = (await session.execute(select(Movie).where(Movie.id == cid))).scalar_one_or_none()
        if not existing:
            try:
                existing = await enrich_movie(session, cid)
            except Exception as exc:  # noqa: BLE001
                log.debug("enrich %s failed: %s", cid, exc)
                continue
        if existing:
            enriched.append(_movie_to_dict(existing, source_meta=c))
    return enriched


async def _tmdb_similar(seed_id: int) -> list[dict[str, Any]]:
    out = await tmdb.similar(seed_id)
    for i, r in enumerate(out):
        r["_tmdb_similar_rank"] = max(0.0, 1.0 - i / 30.0)
    return out


async def _tmdb_recs(seed_id: int) -> list[dict[str, Any]]:
    out = await tmdb.recommendations(seed_id)
    for i, r in enumerate(out):
        r["_tmdb_rec_rank"] = max(0.0, 1.0 - i / 30.0)
    return out


async def _trakt_related(seed_id: int) -> list[dict[str, Any]]:
    rows = await trakt.related(seed_id, limit=20)
    out: list[dict[str, Any]] = []
    for i, r in enumerate(rows):
        ids = (r or {}).get("ids") or {}
        if not ids.get("tmdb"):
            continue
        out.append({"id": ids["tmdb"], "_trakt_rank": max(0.0, 1.0 - i / 20.0)})
    return out


async def _letterboxd_similar(session: AsyncSession, seed: dict[str, Any]) -> list[dict[str, Any]]:
    if not seed.get("title"):
        return []
    items = await letterboxd.similar_films(
        title=seed["title"],
        year=(seed.get("release_date") or "")[:4] or None,
        session=session,
    )
    out: list[dict[str, Any]] = []
    for it in items:
        # We can't resolve the slug -> tmdb here cheaply; instead boost by
        # title match in the scorer. We attach the slug to context later.
        if it.get("title"):
            out.append({"_letterboxd_title": it["title"], "_letterboxd_slug": it.get("slug")})
    return out


async def _reddit_iyl(session: AsyncSession, seed: dict[str, Any]) -> list[dict[str, Any]]:
    if not seed.get("title"):
        return []
    titles = await reddit.recommendations_for(seed["title"], session=session, limit=15)
    out: list[dict[str, Any]] = []
    for t in titles:
        results = await tmdb.search_movies(t, limit=1)
        if results:
            out.append({"id": results[0]["id"], "_reddit_mention": t})
    return out


# ---------- filter ----------


def _filter_candidates(
    candidates: list[dict[str, Any]],
    *,
    library_movie_ids: set[int],
    blocked: dict[str, Any],
    family_friendly: bool,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    blocked_actors: set[int] = {int(x) for x in blocked.get("blockedActors", []) or []}
    blocked_directors: set[int] = {int(x) for x in blocked.get("blockedDirectors", []) or []}
    blocked_genres: set[int] = {int(x) for x in blocked.get("blockedGenres", []) or []}
    safe_certs = {"G", "PG", "PG-13", "TV-G", "TV-PG", "TV-Y", "TV-Y7"}
    for c in candidates:
        if c["id"] in library_movie_ids:
            # Already owned → don't recommend, but the UI cross-link will badge it as owned
            continue
        if blocked_actors and any(int((p.get("id") or 0)) in blocked_actors for p in c.get("cast") or []):
            continue
        if blocked_directors and any(
            int((p.get("id") or 0)) in blocked_directors and p.get("job") == "Director"
            for p in c.get("crew") or []
        ):
            continue
        if blocked_genres and any(int((g.get("id") or 0)) in blocked_genres for g in c.get("genres") or []):
            continue
        if family_friendly and c.get("certification") and c["certification"] not in safe_certs:
            continue
        out.append(c)
    return out


# ---------- context ----------


async def _build_context(
    session: AsyncSession,
    seed: dict[str, Any],
    candidates: list[dict[str, Any]],
    *,
    user_id: str,
    deep_think: bool,
) -> dict[str, Any]:
    ctx: dict[str, Any] = {
        "tmdb_similar_rank": {c["id"]: c.get("_tmdb_similar_rank", 0.0) for c in candidates if c.get("_tmdb_similar_rank")},
        "tmdb_rec_rank": {c["id"]: c.get("_tmdb_rec_rank", 0.0) for c in candidates if c.get("_tmdb_rec_rank")},
        "trakt_related": {c["id"]: c.get("_trakt_rank", 0.0) for c in candidates if c.get("_trakt_rank")},
        "letterboxd_similar_slugs": {c.get("_letterboxd_slug") for c in candidates if c.get("_letterboxd_slug")},
        "reddit_mentions": {(c.get("_reddit_mention") or "").lower() for c in candidates if c.get("_reddit_mention")},
        "cooc_neighbors": await _cooc_neighbors(session, seed.get("id") or 0),
    }

    if deep_think and len(candidates) > 5:
        topk = candidates[:30]
        try:
            ranked = await deep_rerank(
                seed_summary=_seed_summary(seed),
                candidates=[
                    {"id": c["id"], "title": c["title"], "release_date": c.get("release_date"), "overview": c.get("overview")}
                    for c in topk
                ],
                history_summary=await _user_history_summary(session, user_id),
                top_k=20,
            )
            ctx["llm_rerank"] = {mid: max(0.1, 1.0 - i / max(len(ranked), 1)) for i, mid in enumerate(ranked)}
        except Exception as exc:  # noqa: BLE001
            log.warning("deep_rerank failed: %s", exc)

    return ctx


async def _cooc_neighbors(session: AsyncSession, seed_id: int) -> dict[int, float]:
    """Compute a small co-occurrence neighborhood from view_history."""
    if not seed_id:
        return {}
    sessions_with_seed = (
        await session.execute(
            select(ViewHistory.session_id).where(
                ViewHistory.movie_id == seed_id, ViewHistory.session_id.is_not(None)
            )
        )
    ).all()
    session_ids = [r[0] for r in sessions_with_seed if r[0]]
    if not session_ids:
        return {}
    rows = (
        await session.execute(
            select(ViewHistory.movie_id).where(ViewHistory.session_id.in_(session_ids))
        )
    ).all()
    counts: Counter[int] = Counter(r[0] for r in rows if r[0] != seed_id)
    if not counts:
        return {}
    max_n = max(counts.values())
    return {mid: cnt / max_n for mid, cnt in counts.items()}


async def _user_history_summary(session: AsyncSession, user_id: str) -> str:
    rows = (
        await session.execute(
            select(Feedback, Movie)
            .join(Movie, Feedback.movie_id == Movie.id)
            .where(Feedback.user_id == user_id, Feedback.signal == "up")
            .order_by(Feedback.created_at.desc())
            .limit(40)
        )
    ).all()
    if not rows:
        return "(no thumbs-up history yet)"
    return ", ".join(f"{m.title} ({(m.release_date or '????')[:4]})" for _f, m in rows)


# ---------- scoring ----------


async def _score_all(
    seed: dict[str, Any],
    candidates: list[dict[str, Any]],
    context: dict[str, Any],
    weights: dict[str, float],
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for cand in candidates:
        per_scorer = await asyncio.gather(*[s.score(seed, cand, context) for s in scorer_pkg.REGISTERED])
        merged_expl: dict[str, Any] = {}
        per_scorer_payload: dict[str, float] = {}
        total = 0.0
        weight_sum = 0.0
        for scorer, (score, expl) in zip(scorer_pkg.REGISTERED, per_scorer, strict=False):
            w = weights.get(scorer.name, scorer.default_weight)
            total += w * score
            weight_sum += w
            per_scorer_payload[scorer.name] = round(float(score), 3)
            for k, v in (expl or {}).items():
                if v is not None:
                    merged_expl[k] = v
        out.append(
            {
                "candidate": cand,
                "score": total / weight_sum if weight_sum else 0.0,
                "per_scorer": per_scorer_payload,
                "explanation": merged_expl,
            }
        )
    return out


def _resolve_weights(mode: str, user_settings: dict[str, Any]) -> dict[str, float]:
    s = get_settings()
    base: dict[str, float] = {
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
    }
    # Per-mode bias
    if mode == "seed":
        base["content"] *= 1.3
        base["plot_embedding"] *= 1.5
        base["letterboxd"] *= 1.2
    elif mode == "watchparty":
        base["critic"] *= 1.4
        base["awards"] *= 1.4
    elif mode == "hidden_gems":
        base["critic"] *= 0.5
    base.update(user_settings.get("weights") or {})
    return base


def _apply_diversity(scored: list[dict[str, Any]]) -> list[dict[str, Any]]:
    director_seen: Counter[int] = Counter()
    decade_seen: Counter[str] = Counter()
    for s_row in scored:
        cand = s_row["candidate"]
        directors = [
            int(c["id"]) for c in (cand.get("crew") or []) if c.get("job") == "Director" and c.get("id")
        ]
        for d in directors:
            if director_seen[d] >= 2:
                s_row["score"] *= 0.5
            director_seen[d] += 1
        era = (cand.get("release_date") or "")[:3]
        if era:
            if decade_seen[era] >= 8:
                s_row["score"] *= 0.85
            decade_seen[era] += 1
    return scored


# ---------- persistence ----------


async def _persist(
    session: AsyncSession,
    *,
    user_id: str,
    mode: str,
    seed_key: str | None,
    scored: list[dict[str, Any]],
) -> None:
    # Clear previous recs for this (user, mode, seed) and write fresh
    await session.execute(
        Recommendation.__table__.delete().where(
            (Recommendation.user_id == user_id)
            & (Recommendation.mode == mode)
            & ((Recommendation.seed_key == seed_key) if seed_key else (Recommendation.seed_key.is_(None)))
        )
    )
    for row in scored:
        session.add(
            Recommendation(
                user_id=user_id,
                movie_id=row["candidate"]["id"],
                mode=mode,
                seed_key=seed_key,
                score=row["score"],
                per_scorer=row["per_scorer"],
                explanation=row["explanation"],
                rank=row["rank"],
                generated_at=datetime.utcnow(),
            )
        )
    await session.commit()


# ---------- helpers ----------


def _movie_to_dict(m: Movie, *, source_meta: dict[str, Any] | None = None) -> dict[str, Any]:
    d: dict[str, Any] = {
        "id": m.id,
        "imdb_id": m.imdb_id,
        "title": m.title,
        "original_title": m.original_title,
        "overview": m.overview,
        "tagline": m.tagline,
        "release_date": m.release_date,
        "runtime": m.runtime,
        "poster_path": m.poster_path,
        "backdrop_path": m.backdrop_path,
        "original_language": m.original_language,
        "genres": m.genres or [],
        "keywords": m.keywords or [],
        "certification": m.certification,
        "vote_average": m.vote_average,
        "vote_count": m.vote_count,
        "popularity": m.popularity,
        "cast": m.cast or [],
        "crew": m.crew or [],
        "ratings_external": m.ratings_external or {},
        "watch_providers": m.watch_providers or {},
        "awards": m.awards or [],
        "mood_tags": m.mood_tags or [],
        "era_tag": m.era_tag,
    }
    if source_meta:
        for k in ("_tmdb_similar_rank", "_tmdb_rec_rank", "_trakt_rank", "_letterboxd_slug", "_reddit_mention"):
            if k in source_meta:
                d[k] = source_meta[k]
    return d


def _seed_summary(seed: dict[str, Any]) -> str:
    title = seed.get("title", "your taste")
    year = (seed.get("release_date") or "")[:4]
    bits = [f"{title}{f' ({year})' if year else ''}"]
    if seed.get("genres"):
        bits.append("genres: " + ", ".join(g.get("name") or str(g.get("id")) for g in seed["genres"][:6]))
    if seed.get("crew"):
        directors = [c.get("name") or str(c.get("id")) for c in seed["crew"] if c.get("job") == "Director"]
        if directors:
            bits.append("dir: " + ", ".join(directors[:4]))
    return " | ".join(bits)
