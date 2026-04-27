import { redirect } from "next/navigation";

import { readSessionFromCookie } from "@/lib/auth/session";
import { engine } from "@/lib/api";
import { TopBar } from "@/components/layout/top-bar";
import { QuotasTable } from "@/components/admin/quotas-table";

type User = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  daily_quota: number;
};

export default async function AdminQuotasPage(): Promise<React.ReactElement> {
  const user = await readSessionFromCookie();
  if (!user || user.role !== "owner") redirect("/");
  const users = await engine<User[]>("/api/admin/users");
  // Filter to friends only
  const friends = users.filter((u) => u.role === "friend");
  return (
    <main className="min-h-dvh">
      <TopBar user={user} />
      <section className="px-4 sm:px-6 lg:px-10 pb-20 max-w-5xl mx-auto pt-6 space-y-4">
        <h1 className="text-2xl font-semibold">Daily Quotas</h1>
        <p className="text-sm text-[color:var(--brand-text-dim)]">
          Set individual daily request quotas for friends. Unlimited for owner and trusted.
        </p>
        <QuotasTable initial={friends} />
      </section>
    </main>
  );
}
