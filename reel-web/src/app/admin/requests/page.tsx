import { redirect } from "next/navigation";

import { readSessionFromCookie } from "@/lib/auth/session";
import { engine } from "@/lib/api";
import { TopBar } from "@/components/layout/top-bar";
import { RequestsTable } from "@/components/admin/requests-table";

type Req = {
  add_id: number;
  status: string;
  created_at: string;
  user: { id: string; email: string; role: string };
  movie: { id: number; title: string; poster_path: string | null; release_date: string | null };
  note: string | null;
};

export default async function AdminRequests(): Promise<React.ReactElement> {
  const user = await readSessionFromCookie();
  if (!user || user.role !== "owner") redirect("/");
  const reqs = await engine<Req[]>("/api/admin/requests");
  return (
    <main className="min-h-dvh">
      <TopBar user={user} />
      <section className="px-4 sm:px-6 lg:px-10 pb-20 max-w-6xl mx-auto pt-6 space-y-4">
        <h1 className="text-2xl font-semibold">Requests</h1>
        <RequestsTable initial={reqs} />
      </section>
    </main>
  );
}
