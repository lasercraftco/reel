import { redirect } from "next/navigation";

import { readSessionFromCookie } from "@/lib/auth/session";
import { TopBar } from "@/components/layout/top-bar";
import { DiscoverHub } from "@/components/discover/discover-hub";

export default async function DiscoverPage(): Promise<React.ReactElement> {
  const user = await readSessionFromCookie();
  if (!user) redirect("/auth?next=/discover");
  return (
    <main className="min-h-dvh">
      <TopBar user={user} />
      <section className="px-4 sm:px-6 lg:px-10 pb-20 max-w-[1700px] mx-auto pt-6">
        <DiscoverHub />
      </section>
    </main>
  );
}
