"use client";

import Link from "next/link";

import { BRAND } from "@/lib/brand";

export function LandingHero(): React.ReactElement {
  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(60% 60% at 30% 30%, rgba(255,140,66,0.18), transparent 60%), radial-gradient(40% 40% at 80% 80%, rgba(76,201,240,0.18), transparent 60%)",
        }}
      />
      <div className="relative max-w-5xl mx-auto px-6 pt-24 pb-32 text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--brand-primary)]">
          {BRAND.tagline}
        </p>
        <h1 className="mt-4 text-5xl sm:text-7xl font-semibold tracking-tight leading-[1.05]">
          Find your next
          <br />
          <span className="bg-gradient-to-r from-[color:var(--brand-primary)] to-[color:var(--brand-accent)] bg-clip-text text-transparent">
            favorite movie.
          </span>
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-lg text-[color:var(--brand-text-dim)]">
          {BRAND.description}
        </p>
        <div className="mt-10 flex justify-center gap-3">
          <Link href="/auth" className="brand-button-primary">
            Sign in with email
          </Link>
          <a
            href="#features"
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-[color:var(--brand-text-dim)] hover:bg-white/5"
          >
            How it works
          </a>
        </div>
        <div id="features" className="mt-24 grid gap-6 sm:grid-cols-3 text-left">
          <Feature title="Library-aware" body="Scans your Radarr collection and recommends what you DON'T own — no streaming dead-ends." />
          <Feature title="11-signal ensemble" body="Content + plot embeddings + collaborative + Letterboxd + cast/crew + critics + awards + Reddit + LLM rerank." />
          <Feature title="One-click add" body="Tap Add → Radarr queues → qBittorrent grabs → Plex imports. Everything stays local." />
        </div>
      </div>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }): React.ReactElement {
  return (
    <div className="rounded-2xl bg-[color:var(--brand-surface)] p-6 border border-white/5">
      <div className="text-sm uppercase tracking-wider text-[color:var(--brand-primary)]">{title}</div>
      <div className="mt-2 text-[color:var(--brand-text-dim)]">{body}</div>
    </div>
  );
}
