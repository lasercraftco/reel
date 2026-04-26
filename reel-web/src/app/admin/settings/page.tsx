import { redirect } from "next/navigation";

import { readSessionFromCookie } from "@/lib/auth/session";
import { engine } from "@/lib/api";
import { TopBar } from "@/components/layout/top-bar";

type Settings = {
  engine_version: string;
  candidate_pool_size: number;
  exploration_ratio: number;
  friend_daily_quota: number;
  friend_auto_approve: boolean;
  weights_default: Record<string, number>;
};

export default async function AdminSettingsPage(): Promise<React.ReactElement> {
  const user = await readSessionFromCookie();
  if (!user || user.role !== "owner") redirect("/");
  const s = await engine<Settings>("/api/admin/settings");
  return (
    <main className="min-h-dvh">
      <TopBar user={user} />
      <section className="px-4 sm:px-6 lg:px-10 pb-20 max-w-3xl mx-auto pt-6 space-y-6">
        <h1 className="text-2xl font-semibold">Engine settings</h1>
        <div className="rounded-2xl border border-white/5 bg-[color:var(--brand-surface)] p-5 text-sm space-y-2">
          <Row k="Engine version" v={s.engine_version} />
          <Row k="Candidate pool size" v={String(s.candidate_pool_size)} />
          <Row k="Exploration ratio" v={s.exploration_ratio.toFixed(2)} />
          <Row k="Friend daily quota" v={String(s.friend_daily_quota)} />
          <Row k="Friend auto-approve" v={String(s.friend_auto_approve)} />
        </div>
        <div className="rounded-2xl border border-white/5 bg-[color:var(--brand-surface)] p-5 text-sm">
          <h2 className="text-lg font-semibold mb-3">Default scorer weights</h2>
          <ul className="space-y-1">
            {Object.entries(s.weights_default).map(([k, v]) => (
              <Row key={k} k={k} v={v.toFixed(3)} />
            ))}
          </ul>
          <p className="mt-4 text-xs text-[color:var(--brand-text-faint)]">
            Edit ~/homelab/.env values prefixed REEL_DEFAULT_… and restart the engine container to change these.
          </p>
        </div>
      </section>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }): React.ReactElement {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[color:var(--brand-text-dim)]">{k.replace(/_/g, " ")}</span>
      <span className="font-mono">{v}</span>
    </div>
  );
}
