import { redirect } from "next/navigation";

import { readSessionFromCookie } from "@/lib/auth/session";
import { engine } from "@/lib/api";
import { TopBar } from "@/components/layout/top-bar";
import { HeroStrip } from "@/components/feed/hero-strip";
import type { Recommendation } from "@/lib/types";

export default async function SurprisePage(): Promise<React.ReactElement> {
  const user = await readSessionFromCookie();
  if (!user) redirect("/auth");
  const data = await engine<{ movie: Recommendation["movie"]; reason: string }>("/api/smart/surprise");
  const rec: Recommendation = { movie: data.movie, score: 1, explanation: { reason: data.reason } };
  return (
    <main className="min-h-dvh">
      <TopBar user={user} />
      <section className="px-4 sm:px-6 lg:px-10 pb-20 max-w-[1700px] mx-auto pt-6 space-y-6">
        <h1 className="text-2xl font-semibold">Surprise pick</h1>
        <HeroStrip recs={[rec]} />
      </section>
    </main>
  );
}
