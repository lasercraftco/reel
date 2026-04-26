import { redirect } from "next/navigation";

import { readSessionFromCookie } from "@/lib/auth/session";
import { TopBar } from "@/components/layout/top-bar";
import { WatchPartyPlanner } from "@/components/discover/watch-party-planner";

export default async function WatchPartyPage(): Promise<React.ReactElement> {
  const user = await readSessionFromCookie();
  if (!user) redirect("/auth");
  return (
    <main className="min-h-dvh">
      <TopBar user={user} />
      <section className="px-4 sm:px-6 lg:px-10 pb-20 max-w-3xl mx-auto pt-6">
        <h1 className="text-2xl font-semibold mb-2">Watch Party Planner</h1>
        <p className="text-sm text-[color:var(--brand-text-dim)] mb-6">
          Tell me what tonight needs and I'll pick.
        </p>
        <WatchPartyPlanner userId={user.id} />
      </section>
    </main>
  );
}
