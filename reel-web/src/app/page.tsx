import Link from "next/link";

import { readSessionFromCookie } from "@/lib/auth/session";
import { BRAND } from "@/lib/brand";
import { ForYouFeed } from "@/components/feed/for-you-feed";
import { TopBar } from "@/components/layout/top-bar";
import { LandingHero } from "@/components/marketing/landing-hero";

export default async function HomePage(): Promise<React.ReactElement> {
  const user = await readSessionFromCookie();
  if (!user) {
    return (
      <main className="min-h-dvh">
        <LandingHero />
      </main>
    );
  }
  return (
    <main className="min-h-dvh">
      <TopBar user={user} />
      <section className="px-4 sm:px-6 lg:px-10 pb-20 max-w-[1700px] mx-auto">
        <ForYouFeed userId={user.id} />
      </section>
      <footer className="border-t border-white/5 py-6 text-center text-xs text-[color:var(--brand-text-faint)]">
        {BRAND.name} · {BRAND.tagline} ·{" "}
        <Link href="/about" className="underline hover:text-[color:var(--brand-text-dim)]">
          about
        </Link>
      </footer>
    </main>
  );
}
