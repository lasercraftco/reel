import { redirect } from "next/navigation";

import { readSessionFromCookie } from "@/lib/auth/session";
import { engine } from "@/lib/api";
import { TopBar } from "@/components/layout/top-bar";
import { WatchlistView } from "@/components/watchlist/watchlist-view";

type WatchlistItem = {
  movie: {
    id: number;
    title: string;
    release_date: string | null;
    poster_path: string | null;
    runtime: number | null;
    vote_average: number | null;
    genres: { id: number; name: string }[];
  };
  added_at: string | null;
  note: string | null;
  library: { in_library: boolean; status?: string; plex_link?: string | null };
};

export default async function WatchlistPage(): Promise<React.ReactElement> {
  const user = await readSessionFromCookie();
  if (!user) redirect("/auth?next=/watchlist");
  const items = await engine<WatchlistItem[]>("/api/watchlist");
  return (
    <main className="min-h-dvh">
      <TopBar user={user} />
      <section className="px-4 sm:px-6 lg:px-10 pb-20 max-w-[1700px] mx-auto pt-6 space-y-6">
        <h1 className="text-2xl font-semibold">Watchlist</h1>
        <WatchlistView initial={items} />
      </section>
    </main>
  );
}
