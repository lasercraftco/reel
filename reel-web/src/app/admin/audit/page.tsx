import { redirect } from "next/navigation";

import { readSessionFromCookie } from "@/lib/auth/session";
import { engine } from "@/lib/api";
import { TopBar } from "@/components/layout/top-bar";

type Audit = {
  id: number;
  user_id: string | null;
  action: string;
  target: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export default async function AdminAuditPage(): Promise<React.ReactElement> {
  const user = await readSessionFromCookie();
  if (!user || user.role !== "owner") redirect("/");
  const rows = await engine<Audit[]>("/api/admin/audit?limit=300");
  return (
    <main className="min-h-dvh">
      <TopBar user={user} />
      <section className="px-4 sm:px-6 lg:px-10 pb-20 max-w-5xl mx-auto pt-6 space-y-4">
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <ul className="rounded-2xl border border-white/5 divide-y divide-white/5 text-sm font-mono">
          {rows.map((r) => (
            <li key={r.id} className="flex gap-4 px-4 py-2">
              <span className="text-[color:var(--brand-text-faint)] w-44 shrink-0">{new Date(r.created_at).toLocaleString()}</span>
              <span className="text-[color:var(--brand-primary)] w-44 shrink-0">{r.action}</span>
              <span className="text-[color:var(--brand-text-dim)] truncate">{r.target}</span>
              <span className="ml-auto text-xs text-[color:var(--brand-text-faint)] truncate max-w-md">{JSON.stringify(r.metadata)}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
