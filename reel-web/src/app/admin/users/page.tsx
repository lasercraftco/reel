import { redirect } from "next/navigation";

import { readSessionFromCookie } from "@/lib/auth/session";
import { engine } from "@/lib/api";
import { TopBar } from "@/components/layout/top-bar";
import { UsersTable } from "@/components/admin/users-table";

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  blocked: boolean;
  daily_quota: number;
  created_at: string;
  last_seen_at: string | null;
};

export default async function AdminUsers(): Promise<React.ReactElement> {
  const user = await readSessionFromCookie();
  if (!user || user.role !== "owner") redirect("/");
  const users = await engine<AdminUser[]>("/api/admin/users");
  return (
    <main className="min-h-dvh">
      <TopBar user={user} />
      <section className="px-4 sm:px-6 lg:px-10 pb-20 max-w-6xl mx-auto pt-6 space-y-4">
        <h1 className="text-2xl font-semibold">Users</h1>
        <UsersTable users={users} />
      </section>
    </main>
  );
}
