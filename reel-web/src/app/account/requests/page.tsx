import { redirect } from "next/navigation";

import { readSessionFromCookie } from "@/lib/auth/session";
import { engine } from "@/lib/api";
import { TopBar } from "@/components/layout/top-bar";

type MyRequest = {
  add_id: number;
  status: string;
  created_at: string;
  user?: { id: string; email: string; role: string };
  movie: { id: number; title: string; poster_path: string | null };
};

export default async function MyRequestsPage(): Promise<React.ReactElement> {
  const user = await readSessionFromCookie();
  if (!user) redirect("/auth?next=/account/requests");
  // /api/account/requests is the friend-safe self-scope; owners get the
  // same view of their own personal requests here.
  const mine = await engine<MyRequest[]>("/api/account/requests").catch(() => [] as MyRequest[]);
  return (
    <main className="min-h-dvh">
      <TopBar user={user} />
      <section className="px-4 sm:px-6 lg:px-10 pb-20 max-w-3xl mx-auto pt-6 space-y-4">
        <h1 className="text-2xl font-semibold">My Library Activity</h1>
        {mine.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-[color:var(--brand-surface)] p-6 text-[color:var(--brand-text-dim)] text-sm">
            No requests yet.
          </div>
        ) : (
          <ul className="rounded-2xl border border-white/5 divide-y divide-white/5">
            {mine.map((r) => (
              <li key={r.add_id} className="px-4 py-3 flex items-center justify-between">
                <div>{r.movie.title}</div>
                <span className="text-xs uppercase tracking-wider">{r.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
