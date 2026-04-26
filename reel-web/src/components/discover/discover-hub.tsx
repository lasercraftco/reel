"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Trophy, Heart, Wand2, Gem, CalendarDays } from "lucide-react";

import { PosterGrid } from "@/components/feed/poster-grid";
import type { Recommendation } from "@/lib/types";

const TILES = [
  { href: "/discover/hidden-gems", icon: Gem, title: "Hidden Gems", body: "High critic praise, low box office." },
  { href: "/discover/comfort", icon: Heart, title: "Comfort Picks", body: "Highly rated rewatches from your library." },
  { href: "/discover/awards", icon: Trophy, title: "Awards Bait", body: "Festival circuit + Oscar shortlists." },
  { href: "/discover/surprise", icon: Wand2, title: "Surprise Me", body: "Random pick from your top 100 candidates." },
  { href: "/discover/daily-pick", icon: Sparkles, title: "Today's Pick", body: "Engine's call for tonight." },
  { href: "/discover/discovery-weekly", icon: CalendarDays, title: "Discovery Weekly", body: "Mondays — 30 fresh picks." },
];

export function DiscoverHub(): React.ReactElement {
  const { data, isLoading } = useQuery<Recommendation[]>({
    queryKey: ["discovery-weekly"],
    queryFn: async () => (await fetch("/api/engine/smart/discovery-weekly").then((r) => r.json())) as Recommendation[],
  });

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-3xl font-semibold mb-4">Discover</h1>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TILES.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group rounded-2xl border border-white/5 bg-[color:var(--brand-surface)] p-5 hover:border-[color:var(--brand-primary)]/40 hover:bg-white/[0.03] transition"
            >
              <t.icon className="size-5 text-[color:var(--brand-primary)]" />
              <div className="mt-3 font-semibold">{t.title}</div>
              <div className="text-sm text-[color:var(--brand-text-dim)] mt-1">{t.body}</div>
            </Link>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-xl font-semibold mb-3">Discovery Weekly</h2>
        <PosterGrid recs={data ?? []} loading={isLoading} />
      </section>
    </div>
  );
}
