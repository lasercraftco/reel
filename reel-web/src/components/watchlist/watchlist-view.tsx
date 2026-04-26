"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { tmdbImage, formatYear, formatRuntime } from "@/lib/utils";

type Item = {
  movie: { id: number; title: string; release_date: string | null; poster_path: string | null; runtime: number | null; vote_average: number | null; genres: { id: number; name: string }[]; };
  added_at: string | null;
  note: string | null;
  library: { in_library: boolean; status?: string; plex_link?: string | null };
};

type SortKey = "added" | "rating" | "runtime" | "year";

export function WatchlistView({ initial }: { initial: Item[] }): React.ReactElement {
  const [items, setItems] = useState<Item[]>(initial);
  const [sort, setSort] = useState<SortKey>("added");

  async function remove(id: number): Promise<void> {
    setItems((prev) => prev.filter((i) => i.movie.id !== id));
    await fetch(`/api/engine/watchlist/${id}`, { method: "DELETE" });
    toast.success("Removed from watchlist");
  }

  const sorted = [...items].sort((a, b) => {
    switch (sort) {
      case "rating":
        return (b.movie.vote_average ?? 0) - (a.movie.vote_average ?? 0);
      case "runtime":
        return (a.movie.runtime ?? 0) - (b.movie.runtime ?? 0);
      case "year":
        return (b.movie.release_date ?? "").localeCompare(a.movie.release_date ?? "");
      default:
        return (b.added_at ?? "").localeCompare(a.added_at ?? "");
    }
  });

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-white/5 bg-[color:var(--brand-surface)] p-8 text-center text-[color:var(--brand-text-dim)]">
        Nothing saved yet. Hit the bookmark icon on any poster to start your watchlist.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-xs mb-3">
        <span className="text-[color:var(--brand-text-faint)]">Sort by:</span>
        {(["added", "rating", "runtime", "year"] as SortKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setSort(k)}
            className={`rounded-full px-2 py-0.5 ${sort === k ? "bg-[color:var(--brand-primary)]/15 text-[color:var(--brand-primary)]" : "border border-white/10 text-[color:var(--brand-text-dim)]"}`}
          >
            {k}
          </button>
        ))}
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {sorted.map((it) => (
          <li key={it.movie.id} className="group">
            <Link href={`/movie/${it.movie.id}`} className="block relative aspect-[2/3] rounded-lg overflow-hidden poster-shadow bg-[color:var(--brand-surface)]">
              {it.movie.poster_path && (
                <Image src={tmdbImage(it.movie.poster_path, "w342")!} alt={it.movie.title} fill sizes="240px" className="object-cover" />
              )}
              {it.library.in_library && (
                <div className="absolute top-2 left-2 rounded bg-[color:var(--brand-up)] text-black text-[10px] font-bold px-1.5 py-0.5">in library</div>
              )}
            </Link>
            <div className="mt-2 flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-medium leading-tight line-clamp-1">{it.movie.title}</div>
                <div className="text-xs text-[color:var(--brand-text-faint)]">
                  {formatYear(it.movie.release_date)} · {formatRuntime(it.movie.runtime)}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {it.library.plex_link && (
                  <Link href={it.library.plex_link} target="_blank" className="text-[color:var(--brand-text-faint)] hover:text-[color:var(--brand-text-dim)]" title="Open in Plex">
                    <ExternalLink className="size-3.5" />
                  </Link>
                )}
                <button onClick={() => remove(it.movie.id)} className="text-[color:var(--brand-text-faint)] hover:text-[color:var(--brand-down)]" aria-label="Remove">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
