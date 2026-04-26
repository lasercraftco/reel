"use client";

import { PosterCard, PosterCardSkeleton } from "@/components/movie/poster-card";
import type { Recommendation } from "@/lib/types";

export function PosterGrid({
  recs,
  loading,
}: {
  recs: Recommendation[];
  loading?: boolean;
}): React.ReactElement {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
      {loading
        ? Array.from({ length: 18 }).map((_, i) => <PosterCardSkeleton key={i} />)
        : recs.map((r) => <PosterCard key={r.movie.id} rec={r} />)}
    </div>
  );
}
