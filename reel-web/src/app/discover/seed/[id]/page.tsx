import { redirect } from "next/navigation";

import { readSessionFromCookie } from "@/lib/auth/session";
import { engine } from "@/lib/api";
import { TopBar } from "@/components/layout/top-bar";
import { SeedView } from "@/components/discover/seed-view";
import type { MovieDetail } from "@/lib/types";

type Params = { id: string };

export default async function SeedPage({ params }: { params: Promise<Params> }): Promise<React.ReactElement> {
  const user = await readSessionFromCookie();
  if (!user) redirect("/auth");
  const { id } = await params;
  const seedMovie = await engine<MovieDetail>(`/api/movies/${id}`);
  return (
    <main className="min-h-dvh">
      <TopBar user={user} />
      <section className="px-4 sm:px-6 lg:px-10 pb-20 max-w-[1700px] mx-auto pt-6">
        <SeedView seed={seedMovie} userId={user.id} />
      </section>
    </main>
  );
}
