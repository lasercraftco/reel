"use client";

import Link from "next/link";
import { Music, Mic2, Film } from "lucide-react";

/**
 * Cross-app footer links — Genome (music) + Karaoke. SSO via the
 * tyflix_auth cookie (domain=.tyflix.net) keeps the user signed in.
 */
export function CrossAppLinks(): React.ReactElement {
  return (
    <div className="flex justify-center gap-6 text-xs text-[color:var(--brand-text-faint)]">
      <Item href="https://genome.tyflix.net" icon={<Music className="size-3" />}>Genome</Item>
      <Item href="https://karaoke.tyflix.net" icon={<Mic2 className="size-3" />}>Karaoke</Item>
      <Item href="https://reel.tyflix.net" icon={<Film className="size-3" />}>Reel</Item>
    </div>
  );
}

function Item({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }): React.ReactElement {
  return (
    <Link href={href} className="flex items-center gap-1 hover:text-[color:var(--brand-text-dim)]">
      {icon}
      {children}
    </Link>
  );
}
