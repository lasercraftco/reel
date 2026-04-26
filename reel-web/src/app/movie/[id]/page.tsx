import { notFound, redirect } from "next/navigation";

import { readSessionFromCookie } from "@/lib/auth/session";
import { engine } from "@/lib/api";
import { TopBar } from "@/components/layout/top-bar";
import { MovieDetailView } from "@/components/movie/movie-detail-view";
import type { MovieDetail } from "@/lib/types";

type Params = { id: string };

export default async function MoviePage({ params }: { params: Promise<Params> }): Promise<React.ReactElement> {
  const user = await readSessionFromCookie();
  if (!user) redirect("/auth");
  const { id } = await params;
  let detail: MovieDetail | null = null;
  try {
    detail = await engine<MovieDetail>(`/api/movies/${id}`);
  } catch {
    notFound();
  }
  if (!detail) notFound();
  return (
    <main className="min-h-dvh">
      <TopBar user={user} />
      <MovieDetailView movie={detail!} userId={user.id} />
    </main>
  );
}
