"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { tmdbImage } from "@/lib/utils";

type Result = { id: number; title: string; release_date?: string; poster_path?: string };

export function OnboardingFlow({ userId }: { userId: string }): React.ReactElement {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [picked, setPicked] = useState<Result[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const data = (await fetch(`/api/engine/search?q=${encodeURIComponent(query)}&limit=8`).then((r) => r.json())) as Result[];
      setResults(data);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  function pick(r: Result): void {
    if (picked.some((p) => p.id === r.id)) {
      setPicked((p) => p.filter((x) => x.id !== r.id));
    } else if (picked.length < 5) {
      setPicked([...picked, r]);
    } else {
      toast.message("Five picks max — remove one to swap");
    }
  }

  async function finish(): Promise<void> {
    setSubmitting(true);
    try {
      await Promise.all(
        picked.map((p) =>
          fetch("/api/engine/feedback", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ user_id: userId, movie_id: p.id, signal: "seed", weight: 2.0 }),
          })
        )
      );
      toast.success("Taste seeded — building your feed…");
      router.push("/");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-[color:var(--brand-surface)] border border-white/5 p-3 flex items-center gap-2">
        <Search className="size-4 text-[color:var(--brand-text-faint)]" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a film you love…"
          className="flex-1 bg-transparent outline-none text-base"
        />
      </div>
      {results.length > 0 && (
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {results.map((r) => {
            const on = picked.some((p) => p.id === r.id);
            return (
              <button
                key={r.id}
                onClick={() => pick(r)}
                className={`relative aspect-[2/3] rounded-lg overflow-hidden border-2 ${on ? "border-[color:var(--brand-primary)]" : "border-transparent"}`}
              >
                {r.poster_path && (
                  <Image src={tmdbImage(r.poster_path, "w342")!} alt={r.title} fill sizes="200px" className="object-cover" />
                )}
                {on && (
                  <div className="absolute top-1 right-1 size-6 grid place-items-center rounded-full bg-[color:var(--brand-primary)] text-black">
                    <Check className="size-4" />
                  </div>
                )}
              </button>
            );
          })}
        </ul>
      )}
      {picked.length > 0 && (
        <div>
          <div className="text-sm text-[color:var(--brand-text-dim)] mb-2">Picked ({picked.length}/5)</div>
          <div className="flex flex-wrap gap-2">
            {picked.map((p) => (
              <span key={p.id} className="rounded-full text-xs bg-white/5 px-2 py-0.5">
                {p.title} {p.release_date ? `(${p.release_date.slice(0, 4)})` : ""}
              </span>
            ))}
          </div>
        </div>
      )}
      <button onClick={finish} disabled={picked.length < 1 || submitting} className="brand-button-primary flex items-center gap-2">
        {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
        Build my feed
      </button>
    </div>
  );
}
