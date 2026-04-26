import { redirect } from "next/navigation";

import { readSessionFromCookie } from "@/lib/auth/session";
import { engine } from "@/lib/api";
import { TopBar } from "@/components/layout/top-bar";
import { PosterGrid } from "@/components/feed/poster-grid";
import type { Recommendation } from "@/lib/types";

export default async function HiddenGemsPage(): Promise<React.ReactElement> {
  const user = await readSessionFromCookie();
  if (!user) redirect("/auth");
  const recs = await engine<Recommendation[]>("/api/smart/hidden-gems");
  return (
    <main className="min-h-dvh">
      <TopBar user={user} />
      <section className="px-4 sm:px-6 lg:px-10 pb-20 max-w-[1700px] mx-auto pt-6 space-y-4">
        <h1 className="text-2xl font-semibold">Hidden Gems</h1>
        <p className="text-sm text-[color:var(--brand-text-dim)]">
          High critic praise, low box office — films that flew under the radar.
        </p>
        <PosterGrid recs={recs} />
      </section>
    </main>
  );
}
