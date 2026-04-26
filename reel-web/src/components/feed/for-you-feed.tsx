"use client";

import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

import { HeroStrip } from "./hero-strip";
import { PosterGrid } from "./poster-grid";
import { FilterRail, type Filters } from "@/components/filters/filter-rail";
import type { Recommendation } from "@/lib/types";

export function ForYouFeed({ userId }: { userId: string }): React.ReactElement {
  const [filters, setFilters] = useState<Filters>({});
  const [refreshNonce, setRefreshNonce] = useState(0);

  const { data, isLoading } = useQuery<Recommendation[]>({
    queryKey: ["foryou", userId, refreshNonce],
    queryFn: async () => {
      const cached = await fetch("/api/engine/recommend/cached?mode=foryou", { cache: "no-store" });
      if (cached.ok) {
        const list = (await cached.json()) as Recommendation[];
        if (list.length > 6) return list;
      }
      const res = await fetch("/api/engine/recommend/foryou", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: userId, mode: "foryou", limit: 60, deep_think: true }),
      });
      return (await res.json()) as Recommendation[];
    },
  });

  const recs = (data ?? []).filter((r) => _matchesFilters(r, filters));

  const refresh = useCallback(() => setRefreshNonce((n) => n + 1), []);

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-6 mt-6">
      <FilterRail filters={filters} setFilters={setFilters} onRefresh={refresh} />
      <div className="space-y-8">
        <HeroStrip recs={recs.slice(0, 3)} />
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-xl font-semibold">For You</h2>
            <div className="text-xs text-[color:var(--brand-text-faint)]">
              {recs.length} picks · scored by 11 signals
            </div>
          </div>
          <PosterGrid recs={recs.slice(3)} loading={isLoading} />
        </section>
      </div>
    </div>
  );
}

function _matchesFilters(r: Recommendation, f: Filters): boolean {
  const m = r.movie;
  if (f.minRating && (m.vote_average ?? 0) < f.minRating) return false;
  if (f.maxRuntime && (m.runtime ?? 0) > f.maxRuntime) return false;
  if (f.yearFrom && m.release_date && Number(m.release_date.slice(0, 4)) < f.yearFrom) return false;
  if (f.yearTo && m.release_date && Number(m.release_date.slice(0, 4)) > f.yearTo) return false;
  if (f.genres && f.genres.length > 0) {
    const ids = new Set(m.genres.map((g) => g.id));
    if (!f.genres.some((g) => ids.has(g))) return false;
  }
  if (f.languages && f.languages.length > 0 && m.original_language) {
    if (!f.languages.includes(m.original_language)) return false;
  }
  return true;
}
