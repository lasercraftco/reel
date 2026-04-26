"use client";

import { RefreshCw } from "lucide-react";

const TMDB_GENRES = [
  { id: 28, name: "Action" }, { id: 12, name: "Adventure" }, { id: 16, name: "Animation" },
  { id: 35, name: "Comedy" }, { id: 80, name: "Crime" }, { id: 99, name: "Documentary" },
  { id: 18, name: "Drama" }, { id: 10751, name: "Family" }, { id: 14, name: "Fantasy" },
  { id: 36, name: "History" }, { id: 27, name: "Horror" }, { id: 10402, name: "Music" },
  { id: 9648, name: "Mystery" }, { id: 10749, name: "Romance" }, { id: 878, name: "Sci-Fi" },
  { id: 10770, name: "TV Movie" }, { id: 53, name: "Thriller" }, { id: 10752, name: "War" },
  { id: 37, name: "Western" },
];

export type Filters = {
  yearFrom?: number;
  yearTo?: number;
  minRating?: number;
  maxRuntime?: number;
  genres?: number[];
  languages?: string[];
};

export function FilterRail({
  filters,
  setFilters,
  onRefresh,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  onRefresh: () => void;
}): React.ReactElement {
  function toggleGenre(id: number): void {
    const set = new Set(filters.genres ?? []);
    set.has(id) ? set.delete(id) : set.add(id);
    setFilters({ ...filters, genres: Array.from(set) });
  }

  return (
    <aside className="sticky top-20 self-start rounded-2xl bg-[color:var(--brand-surface)] border border-white/5 p-4 text-sm space-y-5 max-h-[calc(100vh-6rem)] overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Filters</h3>
        <button
          onClick={onRefresh}
          className="text-xs flex items-center gap-1 text-[color:var(--brand-primary)] hover:underline"
        >
          <RefreshCw className="size-3" /> recompute
        </button>
      </div>
      <Section label="Year">
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="from"
            value={filters.yearFrom ?? ""}
            onChange={(e) => setFilters({ ...filters, yearFrom: e.target.value ? Number(e.target.value) : undefined })}
            className="w-1/2 rounded-md bg-black/30 border border-white/10 px-2 py-1"
          />
          <input
            type="number"
            placeholder="to"
            value={filters.yearTo ?? ""}
            onChange={(e) => setFilters({ ...filters, yearTo: e.target.value ? Number(e.target.value) : undefined })}
            className="w-1/2 rounded-md bg-black/30 border border-white/10 px-2 py-1"
          />
        </div>
      </Section>
      <Section label={`Min rating ${filters.minRating ?? "—"}`}>
        <input
          type="range"
          min="0"
          max="10"
          step="0.5"
          value={filters.minRating ?? 0}
          onChange={(e) => setFilters({ ...filters, minRating: Number(e.target.value) })}
          className="w-full"
        />
      </Section>
      <Section label={`Max runtime ${filters.maxRuntime ? `${filters.maxRuntime}m` : "—"}`}>
        <input
          type="range"
          min="60"
          max="240"
          step="5"
          value={filters.maxRuntime ?? 240}
          onChange={(e) => setFilters({ ...filters, maxRuntime: Number(e.target.value) })}
          className="w-full"
        />
      </Section>
      <Section label="Genres">
        <div className="flex flex-wrap gap-1">
          {TMDB_GENRES.map((g) => {
            const on = filters.genres?.includes(g.id);
            return (
              <button
                key={g.id}
                onClick={() => toggleGenre(g.id)}
                className={`text-xs rounded-full px-2 py-0.5 border ${
                  on
                    ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)]/15 text-[color:var(--brand-primary)]"
                    : "border-white/10 text-[color:var(--brand-text-dim)] hover:border-white/30"
                }`}
              >
                {g.name}
              </button>
            );
          })}
        </div>
      </Section>
    </aside>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[color:var(--brand-text-faint)] mb-2">
        {label}
      </div>
      {children}
    </div>
  );
}
