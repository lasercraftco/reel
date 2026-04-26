"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, Check, ExternalLink, Plus, ThumbsDown, ThumbsUp, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { tmdbImage, formatRuntime, formatYear } from "@/lib/utils";
import type { MovieDetail, MovieSummary } from "@/lib/types";
import { PosterGrid } from "@/components/feed/poster-grid";

export function MovieDetailView({ movie, userId }: { movie: MovieDetail; userId: string }): React.ReactElement {
  const backdrop = tmdbImage(movie.backdrop_path, "original") || tmdbImage(movie.poster_path, "w780");
  const [added, setAdded] = useState(movie.library_status === "imported" || movie.library_status === "downloaded");
  const [adding, setAdding] = useState(false);
  const director = movie.crew.find((c) => c.job === "Director");

  const similar = useQuery({
    queryKey: ["similar", movie.id],
    queryFn: async () => (await fetch(`/api/engine/movies/${movie.id}/similar`).then((r) => r.json())) as MovieSummary[],
  });

  async function add(): Promise<void> {
    setAdding(true);
    try {
      const res = await fetch("/api/engine/library/add", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: userId, movie_id: movie.id }),
      });
      const data: { status: string } = await res.json();
      if (data.status === "submitted") {
        setAdded(true);
        toast.success(`Added "${movie.title}" to Radarr`);
      } else if (data.status === "requested") {
        toast.success(`Request sent`);
      } else {
        toast.message(`Status: ${data.status}`);
      }
    } catch {
      toast.error("Couldn't add");
    } finally {
      setAdding(false);
    }
  }

  async function thumb(signal: "up" | "down"): Promise<void> {
    await fetch("/api/engine/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: userId, movie_id: movie.id, signal }),
    });
    toast.success(signal === "up" ? "Thanks — we'll surface more like this" : "Got it — fewer like this");
  }

  async function watchlist(): Promise<void> {
    await fetch("/api/engine/watchlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: userId, movie_id: movie.id }),
    });
    toast.success("Saved to watchlist");
  }

  return (
    <article>
      <div className="relative">
        {backdrop && (
          <div className="relative h-[40vh] sm:h-[60vh] w-full">
            <Image src={backdrop} alt={movie.title} fill priority className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--brand-bg)] via-[color:var(--brand-bg)]/60 to-transparent" />
          </div>
        )}
        <div className="max-w-[1500px] mx-auto px-4 sm:px-8 -mt-32 relative grid sm:grid-cols-[200px_1fr] lg:grid-cols-[260px_1fr] gap-6">
          <div className="hidden sm:block relative aspect-[2/3] rounded-2xl overflow-hidden poster-shadow">
            {movie.poster_path && (
              <Image src={tmdbImage(movie.poster_path, "w500")!} alt={movie.title} fill sizes="260px" className="object-cover" />
            )}
          </div>
          <div className="pt-4">
            <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight">{movie.title}</h1>
            <div className="text-sm text-[color:var(--brand-text-dim)] mt-1 flex flex-wrap gap-2">
              <span>{formatYear(movie.release_date)}</span>
              <span>·</span>
              <span>{formatRuntime(movie.runtime)}</span>
              {movie.certification && (<><span>·</span><span>{movie.certification}</span></>)}
              {movie.original_language && (<><span>·</span><span>{movie.original_language.toUpperCase()}</span></>)}
            </div>
            {movie.tagline && (
              <p className="italic text-[color:var(--brand-text-dim)] mt-3">{movie.tagline}</p>
            )}
            <p className="mt-4 max-w-2xl text-[color:var(--brand-text)]/95">{movie.overview}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {!added ? (
                <button onClick={add} disabled={adding} className="brand-button-primary flex items-center gap-1">
                  {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  Add to library
                </button>
              ) : (
                <div className="rounded-md bg-[color:var(--brand-up)]/15 text-[color:var(--brand-up)] px-3 py-1.5 text-sm flex items-center gap-1">
                  <Check className="size-4" /> in library
                </div>
              )}
              <button onClick={watchlist} className="rounded-md border border-white/15 bg-black/30 hover:bg-black/50 px-3 py-1.5 text-sm flex items-center gap-1">
                <Bookmark className="size-4" /> Watchlist
              </button>
              <button onClick={() => thumb("up")} className="rounded-md border border-white/15 bg-black/30 hover:bg-black/50 px-3 py-1.5 text-sm flex items-center gap-1">
                <ThumbsUp className="size-4" /> Love it
              </button>
              <button onClick={() => thumb("down")} className="rounded-md border border-white/15 bg-black/30 hover:bg-black/50 px-3 py-1.5 text-sm flex items-center gap-1">
                <ThumbsDown className="size-4" /> Not for me
              </button>
              {movie.imdb_id && (
                <Link href={`https://www.imdb.com/title/${movie.imdb_id}/`} target="_blank" className="rounded-md border border-white/15 px-3 py-1.5 text-sm flex items-center gap-1">
                  IMDb <ExternalLink className="size-3" />
                </Link>
              )}
              <Link href={`https://www.themoviedb.org/movie/${movie.id}`} target="_blank" className="rounded-md border border-white/15 px-3 py-1.5 text-sm flex items-center gap-1">
                TMDB <ExternalLink className="size-3" />
              </Link>
            </div>
            {director && (
              <div className="mt-6 text-sm text-[color:var(--brand-text-dim)]">
                <span className="text-[color:var(--brand-text-faint)]">Directed by</span>{" "}
                <Link className="hover:underline" href={`/discover/director/${director.id}`}>{director.name}</Link>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-1">
              {movie.genres.map((g) => (
                <span key={g.id} className="rounded-full text-xs px-2 py-0.5 bg-white/5 text-[color:var(--brand-text-dim)]">
                  {g.name}
                </span>
              ))}
              {movie.mood_tags?.map((t) => (
                <span key={t} className="rounded-full text-xs px-2 py-0.5 bg-[color:var(--brand-primary)]/15 text-[color:var(--brand-primary)]">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section className="max-w-[1500px] mx-auto px-4 sm:px-8 mt-12 grid lg:grid-cols-[1fr_320px] gap-10">
        <div className="space-y-10">
          <Block title="Cast">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {movie.cast.slice(0, 10).map((c) => (
                <div key={c.id} className="text-center">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-[color:var(--brand-surface)] mb-2">
                    {c.profilePath && (
                      <Image src={tmdbImage(c.profilePath, "w185")!} alt={c.name} fill sizes="140px" className="object-cover" />
                    )}
                  </div>
                  <div className="text-sm font-medium leading-tight">{c.name}</div>
                  <div className="text-xs text-[color:var(--brand-text-faint)] line-clamp-1">{c.character}</div>
                </div>
              ))}
            </div>
          </Block>
          <Block title="If you like this, also try…">
            <PosterGrid
              recs={(similar.data ?? []).map((m) => ({ movie: { ...m, genres: m.genres ?? [] }, score: 1 }))}
              loading={similar.isLoading}
            />
          </Block>
        </div>
        <aside className="space-y-6">
          <Block title="Ratings">
            <Ratings ext={movie.ratings_external ?? {}} tmdb={movie.vote_average ?? null} />
          </Block>
          <Block title="Crew">
            <ul className="text-sm space-y-1">
              {movie.crew.slice(0, 12).map((c) => (
                <li key={`${c.id}-${c.job}`} className="flex justify-between">
                  <span>{c.name}</span>
                  <span className="text-[color:var(--brand-text-faint)] text-xs">{c.job}</span>
                </li>
              ))}
            </ul>
          </Block>
          {movie.keywords?.length > 0 && (
            <Block title="Keywords">
              <div className="flex flex-wrap gap-1">
                {movie.keywords.slice(0, 18).map((k) => (
                  <Link key={k.id} href={`/discover/keyword/${k.id}`} className="text-xs rounded-full border border-white/10 px-2 py-0.5 hover:border-[color:var(--brand-primary)]">
                    {k.name}
                  </Link>
                ))}
              </div>
            </Block>
          )}
        </aside>
      </section>
    </article>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section>
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Ratings({ ext, tmdb }: { ext: Record<string, number | undefined>; tmdb: number | null }): React.ReactElement {
  const items = [
    tmdb && { label: "TMDB", value: `${tmdb.toFixed(1)} / 10` },
    ext.imdb && { label: "IMDb", value: `${ext.imdb.toFixed(1)} / 10` },
    ext.rt && { label: "Rotten Tomatoes", value: `${Math.round(ext.rt)}%` },
    ext.mc && { label: "Metacritic", value: `${Math.round(ext.mc)}` },
    ext.letterboxd && { label: "Letterboxd", value: `${ext.letterboxd.toFixed(1)} / 5` },
  ].filter(Boolean) as Array<{ label: string; value: string }>;
  if (items.length === 0) return <div className="text-sm text-[color:var(--brand-text-faint)]">No external ratings yet.</div>;
  return (
    <ul className="text-sm space-y-1">
      {items.map((i) => (
        <li key={i.label} className="flex justify-between">
          <span className="text-[color:var(--brand-text-dim)]">{i.label}</span>
          <span className="font-medium">{i.value}</span>
        </li>
      ))}
    </ul>
  );
}
