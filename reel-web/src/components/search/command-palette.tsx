"use client";

import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import { Search } from "lucide-react";

import { tmdbImage } from "@/lib/utils";

type Result = {
  id: number;
  title: string;
  release_date?: string;
  poster_path?: string;
};

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.ReactElement {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onOpenChange]);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/engine/search?q=${encodeURIComponent(query)}&limit=10`);
        const data = (await res.json()) as Result[];
        if (!cancelled) setResults(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-[15%] left-1/2 -translate-x-1/2 z-50 w-[min(640px,92vw)] rounded-2xl bg-[color:var(--brand-surface)] border border-white/10 shadow-2xl">
          <Command label="Search" className="flex flex-col">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
              <Search className="size-4 text-[color:var(--brand-text-faint)]" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Search any movie title…"
                autoFocus
                className="flex-1 bg-transparent outline-none text-base placeholder:text-[color:var(--brand-text-faint)]"
              />
              <kbd className="text-[10px] rounded bg-white/10 px-1 py-0.5">esc</kbd>
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              {loading && <Command.Loading>Searching TMDB…</Command.Loading>}
              {!loading && results.length === 0 && query.length >= 2 && (
                <Command.Empty className="px-4 py-6 text-sm text-[color:var(--brand-text-faint)]">
                  No movies match.
                </Command.Empty>
              )}
              {!loading && query.length < 2 && (
                <div className="px-4 py-6 text-sm text-[color:var(--brand-text-faint)]">
                  Start typing to search any movie. Pick one to see "more like this".
                </div>
              )}
              {results.map((r) => (
                <Command.Item
                  key={r.id}
                  value={`${r.id}:${r.title}`}
                  onSelect={() => {
                    onOpenChange(false);
                    router.push(`/discover/seed/${r.id}`);
                  }}
                  className="flex items-center gap-3 rounded-md p-2 cursor-pointer aria-selected:bg-white/5 outline-none"
                >
                  {r.poster_path && (
                    <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded">
                      <Image src={tmdbImage(r.poster_path, "w92") || ""} alt={r.title} fill className="object-cover" />
                    </div>
                  )}
                  <div>
                    <div className="text-sm">{r.title}</div>
                    <div className="text-xs text-[color:var(--brand-text-faint)]">
                      {r.release_date?.slice(0, 4) || "—"}
                    </div>
                  </div>
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
