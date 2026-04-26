"use client";

import Image from "next/image";
import { useQuery } from "@tanstack/react-query";

import { tmdbImage } from "@/lib/utils";
import type { MovieDetail, Recommendation } from "@/lib/types";
import { PosterGrid } from "@/components/feed/poster-grid";

export function SeedView({ seed, userId }: { seed: MovieDetail; userId: string }): React.ReactElement {
  const { data, isLoading } = useQuery<Recommendation[]>({
    queryKey: ["seed", seed.id, userId],
    queryFn: async () => {
      const res = await fetch("/api/engine/recommend/seed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: userId, seed_movie_id: seed.id, limit: 60 }),
      });
      return (await res.json()) as Recommendation[];
    },
  });

  const backdrop = tmdbImage(seed.backdrop_path, "w1280") || tmdbImage(seed.poster_path, "w780");

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-white/5">
        {backdrop && (
          <div className="relative aspect-[16/6]">
            <Image src={backdrop} alt={seed.title} fill priority className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
          </div>
        )}
        <div className="absolute inset-0 flex items-end p-6 sm:p-10">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--brand-primary)]">Seed</div>
            <h1 className="text-3xl sm:text-5xl font-semibold mt-1">{seed.title}</h1>
            <p className="text-sm text-[color:var(--brand-text-dim)] mt-3 line-clamp-3">{seed.overview}</p>
          </div>
        </div>
      </section>
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-xl font-semibold">More like {seed.title}</h2>
          <div className="text-xs text-[color:var(--brand-text-faint)]">
            {data?.length ?? 0} picks · ensemble-scored
          </div>
        </div>
        <WhyThesePicks recs={data ?? []} />
        <div className="mt-4">
          <PosterGrid recs={data ?? []} loading={isLoading} />
        </div>
      </section>
    </div>
  );
}

function WhyThesePicks({ recs }: { recs: Recommendation[] }): React.ReactElement {
  if (recs.length === 0) return <div />;
  // Pull the top scorers used across the recs to summarize the seed's pull
  const scorerHits: Record<string, number> = {};
  for (const r of recs.slice(0, 20)) {
    for (const [k, v] of Object.entries(r.per_scorer ?? {})) {
      if (typeof v === "number" && v > 0.4) scorerHits[k] = (scorerHits[k] ?? 0) + 1;
    }
  }
  const sorted = Object.entries(scorerHits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  if (sorted.length === 0) return <div />;
  return (
    <div className="rounded-xl bg-[color:var(--brand-surface)] border border-white/5 px-4 py-3 text-sm text-[color:var(--brand-text-dim)]">
      <span className="text-[color:var(--brand-text-faint)] mr-2">Why these picks:</span>
      {sorted.map(([k, n]) => (
        <span key={k} className="mr-2 rounded bg-white/5 px-2 py-0.5 text-xs">
          {k.replace(/_/g, " ")} ({n})
        </span>
      ))}
    </div>
  );
}
