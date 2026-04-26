"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";

import { PosterCard } from "@/components/movie/poster-card";
import type { Recommendation } from "@/lib/types";

const MOODS = ["mind-bender", "tearjerker", "comfort", "midnight movie", "date night", "kid-friendly", "awards bait"];

export function WatchPartyPlanner({ userId }: { userId: string }): React.ReactElement {
  const [runtime, setRuntime] = useState(120);
  const [mood, setMood] = useState<string>("");
  const [familyFriendly, setFamilyFriendly] = useState(false);
  const [n, setN] = useState(3);
  const [loading, setLoading] = useState(false);
  const [picks, setPicks] = useState<Recommendation[]>([]);

  async function pick(): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch("/api/engine/smart/watchparty", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          runtime_max_minutes: runtime,
          mood: mood || null,
          family_friendly: familyFriendly,
          n,
        }),
      });
      const data = (await res.json()) as Array<{ movie: Recommendation["movie"]; score: number; explanation?: { reason?: string } }>;
      setPicks(data.map((d) => ({ movie: d.movie, score: d.score, explanation: d.explanation })));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-[color:var(--brand-surface)] border border-white/5 p-5 space-y-4">
        <Field label={`We have up to ${runtime} minutes`}>
          <input type="range" min="60" max="240" step="5" value={runtime} onChange={(e) => setRuntime(Number(e.target.value))} className="w-full" />
        </Field>
        <Field label="Mood">
          <div className="flex flex-wrap gap-1">
            <Chip on={!mood} onClick={() => setMood("")}>any</Chip>
            {MOODS.map((m) => (
              <Chip key={m} on={mood === m} onClick={() => setMood(m === mood ? "" : m)}>{m}</Chip>
            ))}
          </div>
        </Field>
        <Field label="How many picks?">
          <div className="flex items-center gap-2">
            {[1, 3, 5].map((v) => (
              <button key={v} onClick={() => setN(v)} className={`rounded-full px-3 py-0.5 text-sm ${n === v ? "bg-[color:var(--brand-primary)]/15 text-[color:var(--brand-primary)]" : "border border-white/10 text-[color:var(--brand-text-dim)]"}`}>
                {v}
              </button>
            ))}
          </div>
        </Field>
        <label className="flex items-center gap-2 text-sm text-[color:var(--brand-text-dim)]">
          <input type="checkbox" checked={familyFriendly} onChange={(e) => setFamilyFriendly(e.target.checked)} />
          Family-friendly only
        </label>
        <button onClick={pick} disabled={loading} className="brand-button-primary flex items-center gap-2">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Pick tonight's movie
        </button>
      </div>
      {picks.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {picks.map((p) => <PosterCard key={p.movie.id} rec={p} />)}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-[color:var(--brand-text-faint)] mb-2">{label}</div>
      {children}
    </div>
  );
}

function Chip({ children, on, onClick }: { children: React.ReactNode; on: boolean; onClick: () => void }): React.ReactElement {
  return (
    <button onClick={onClick} className={`text-xs rounded-full px-2 py-0.5 border ${on ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)]/15 text-[color:var(--brand-primary)]" : "border-white/10 text-[color:var(--brand-text-dim)]"}`}>
      {children}
    </button>
  );
}
