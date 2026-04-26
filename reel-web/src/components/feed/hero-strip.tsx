"use client";

import Image from "next/image";
import Link from "next/link";
import { Plus, Play, Info } from "lucide-react";

import { tmdbImage, formatRuntime, formatYear } from "@/lib/utils";
import type { Recommendation } from "@/lib/types";

export function HeroStrip({ recs }: { recs: Recommendation[] }): React.ReactElement {
  const top = recs.slice(0, 3);
  if (top.length === 0) {
    return <div className="h-64 sm:h-80 skeleton rounded-3xl" />;
  }
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {top.map((r, i) => (
        <HeroCard rec={r} featured={i === 0} key={r.movie.id} />
      ))}
    </div>
  );
}

function HeroCard({ rec, featured }: { rec: Recommendation; featured: boolean }): React.ReactElement {
  const m = rec.movie;
  const backdrop = tmdbImage(m.backdrop_path, "w780") || tmdbImage(m.poster_path, "w780");
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-white/5 ${featured ? "lg:col-span-2 aspect-[16/9]" : "aspect-[16/9] lg:aspect-[5/6]"}`}
    >
      {backdrop && (
        <Image
          src={backdrop}
          alt={m.title}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
          priority={featured}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
        <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--brand-primary)] mb-2">
          Today's pick · rank {rec.rank ?? "—"}
        </div>
        <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight">{m.title}</h2>
        <div className="text-sm text-[color:var(--brand-text-dim)] mt-1 flex gap-2">
          <span>{formatYear(m.release_date)}</span>
          <span>·</span>
          <span>{formatRuntime(m.runtime)}</span>
          {m.vote_average && (
            <>
              <span>·</span>
              <span>★ {m.vote_average.toFixed(1)}</span>
            </>
          )}
        </div>
        {rec.explanation?.reason && (
          <p className="mt-3 text-sm sm:text-base max-w-2xl text-[color:var(--brand-text)]/90 line-clamp-3">
            {String(rec.explanation.reason)}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="brand-button-primary text-sm flex items-center gap-1">
            <Plus className="size-4" /> Add to library
          </button>
          <Link
            href={`/movie/${m.id}`}
            className="rounded-md border border-white/15 bg-black/30 hover:bg-black/50 px-3 py-1.5 text-sm flex items-center gap-1"
          >
            <Info className="size-4" /> Details
          </Link>
        </div>
      </div>
    </div>
  );
}
