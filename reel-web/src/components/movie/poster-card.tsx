"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Plus, Check, Loader2, Bookmark, ThumbsUp, ThumbsDown, Info, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import { tmdbImage, formatRuntime, formatYear } from "@/lib/utils";
import type { Recommendation } from "@/lib/types";

type Props = {
  rec: Recommendation;
  onAdded?: (movieId: number) => void;
  onWatchlisted?: (movieId: number) => void;
  onFeedback?: (movieId: number, signal: "up" | "down") => void;
};

export function PosterCard({ rec, onAdded, onWatchlisted, onFeedback }: Props): React.ReactElement {
  const [hover, setHover] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(rec.library?.in_library ?? false);
  const [requested, setRequested] = useState(rec.library?.status === "requested");
  const m = rec.movie;
  const poster = tmdbImage(m.poster_path, "w500");
  const ext = m.ratings_external ?? {};
  const ratingChips = [
    ext.rt && `RT ${Math.round(ext.rt)}%`,
    ext.mc && `MC ${Math.round(ext.mc)}`,
    ext.imdb && `IMDb ${ext.imdb.toFixed(1)}`,
    ext.letterboxd && `LB ${ext.letterboxd.toFixed(1)}`,
  ].filter(Boolean) as string[];

  async function handleAdd(): Promise<void> {
    setAdding(true);
    try {
      const res = await fetch("/api/engine/library/add", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: "self", movie_id: m.id }),
      });
      const data: { status: string } = await res.json();
      if (!res.ok) throw new Error("add failed");
      if (data.status === "submitted") {
        setAdded(true);
        toast.success(`Added "${m.title}" to Radarr`);
        onAdded?.(m.id);
      } else if (data.status === "requested") {
        setRequested(true);
        toast.success(`Request sent — Tyler will approve "${m.title}"`);
      } else if (data.status === "approved") {
        setRequested(true);
        toast.message(`Request approved — Radarr is grabbing "${m.title}"`);
      } else {
        toast.message(`Status: ${data.status}`);
      }
    } catch (err) {
      toast.error("Couldn't add to library");
      console.error(err);
    } finally {
      setAdding(false);
    }
  }

  async function handleWatchlist(): Promise<void> {
    try {
      await fetch("/api/engine/watchlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: "self", movie_id: m.id }),
      });
      toast.success(`Saved "${m.title}" to your watchlist`);
      onWatchlisted?.(m.id);
    } catch {
      toast.error("Couldn't save");
    }
  }

  async function handleFeedback(signal: "up" | "down"): Promise<void> {
    try {
      await fetch("/api/engine/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: "self", movie_id: m.id, signal }),
      });
      onFeedback?.(m.id, signal);
    } catch {
      toast.error("Couldn't record feedback");
    }
  }

  return (
    <div
      className="group relative aspect-[2/3] w-full"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Link href={`/movie/${m.id}`} className="block size-full">
        <div className="relative size-full overflow-hidden rounded-[var(--brand-radius)] poster-shadow bg-[color:var(--brand-surface)]">
          {poster ? (
            <Image
              src={poster}
              alt={m.title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-[color:var(--brand-text-faint)] text-xs px-3 text-center">
              {m.title}
            </div>
          )}
          {added && (
            <div className="absolute top-2 left-2 rounded-md bg-[color:var(--brand-up)] text-black text-[10px] font-bold px-1.5 py-0.5 flex items-center gap-1">
              <Check className="size-3" /> in library
            </div>
          )}
          {requested && !added && (
            <div className="absolute top-2 left-2 rounded-md bg-[color:var(--brand-warn)] text-black text-[10px] font-bold px-1.5 py-0.5">
              requested
            </div>
          )}
        </div>
      </Link>
      <AnimatePresence>
        {hover && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute -inset-x-1 -bottom-2 z-30 translate-y-full rounded-lg border border-white/5 bg-[color:var(--brand-surface)] p-3 shadow-2xl"
          >
            <div className="font-semibold text-sm leading-tight line-clamp-2">{m.title}</div>
            <div className="text-[10px] uppercase tracking-wide text-[color:var(--brand-text-faint)] mt-1 flex gap-2">
              <span>{formatYear(m.release_date)}</span>
              <span>·</span>
              <span>{formatRuntime(m.runtime)}</span>
              {m.era_tag && (
                <>
                  <span>·</span>
                  <span>{m.era_tag}</span>
                </>
              )}
            </div>
            {ratingChips.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                {ratingChips.map((c) => (
                  <span key={c} className="rounded bg-white/5 px-1.5 py-0.5 text-[color:var(--brand-text-dim)]">
                    {c}
                  </span>
                ))}
              </div>
            )}
            {rec.explanation?.reason && (
              <p className="text-xs text-[color:var(--brand-text-dim)] mt-2 line-clamp-3">
                {String(rec.explanation.reason)}
              </p>
            )}
            <div className="mt-3 flex items-center gap-2">
              {!added && (
                <button
                  onClick={handleAdd}
                  disabled={adding || requested}
                  className="brand-button-primary text-xs px-2 py-1 flex items-center gap-1"
                >
                  {adding ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                  {requested ? "Pending" : "Add"}
                </button>
              )}
              <button
                onClick={handleWatchlist}
                className="text-xs flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 hover:bg-white/5"
                aria-label="Watchlist"
              >
                <Bookmark className="size-3" />
                Save
              </button>
              <button onClick={() => handleFeedback("up")} aria-label="Thumbs up" className="ml-auto p-1 rounded hover:bg-white/5">
                <ThumbsUp className="size-3.5 text-[color:var(--brand-text-dim)]" />
              </button>
              <button onClick={() => handleFeedback("down")} aria-label="Thumbs down" className="p-1 rounded hover:bg-white/5">
                <ThumbsDown className="size-3.5 text-[color:var(--brand-text-dim)]" />
              </button>
              <Link href={`/movie/${m.id}`} aria-label="Details" className="p-1 rounded hover:bg-white/5">
                <Info className="size-3.5 text-[color:var(--brand-text-dim)]" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PosterCardSkeleton(): React.ReactElement {
  return <div className="aspect-[2/3] w-full skeleton" />;
}
