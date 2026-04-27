import { redirect } from "next/navigation";
import Link from "next/link";

import { readSessionFromCookie } from "@/lib/auth/session";
import { TopBar } from "@/components/layout/top-bar";

const TILES = [
  { href: "/admin/users", title: "Users", body: "Manage roles, blocks, and promotions." },
  { href: "/admin/quotas", title: "Daily Quotas", body: "Set per-friend request limits." },
  { href: "/admin/audit", title: "Audit log", body: "Every action across users." },
  { href: "/admin/settings", title: "Settings", body: "Engine weights + global config." },
];

export default async function AdminHome(): Promise<React.ReactElement> {
  const user = await readSessionFromCookie();
  if (!user || user.role !== "owner") redirect("/");
  return (
    <main className="min-h-dvh">
      <TopBar user={user} />
      <section className="px-4 sm:px-6 lg:px-10 pb-20 max-w-5xl mx-auto pt-6">
        <h1 className="text-2xl font-semibold mb-6">Admin</h1>
        <div className="grid sm:grid-cols-2 gap-3">
          {TILES.map((t) => (
            <Link key={t.href} href={t.href} className="block rounded-2xl border border-white/5 bg-[color:var(--brand-surface)] p-5 hover:border-[color:var(--brand-primary)]/40">
              <div className="font-semibold">{t.title}</div>
              <div className="text-sm text-[color:var(--brand-text-dim)] mt-1">{t.body}</div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
