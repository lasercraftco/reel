"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, BookmarkCheck, Search as SearchIcon, Settings, User as UserIcon, Wand2 } from "lucide-react";

import { BRAND } from "@/lib/brand";
import type { SessionUser } from "@/lib/types";
import { CommandPalette } from "@/components/search/command-palette";
import { UserMenu } from "@/components/auth/user-menu";

export function TopBar({ user }: { user: SessionUser }): React.ReactElement {
  const [paletteOpen, setPaletteOpen] = useState(false);
  return (
    <>
      <header className="glass sticky top-0 z-40 border-b border-white/5">
        <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-10 py-3 flex items-center gap-4">
          <Link href="/" className="font-semibold text-lg tracking-tight">
            <span className="bg-gradient-to-r from-[color:var(--brand-primary)] to-[color:var(--brand-accent)] bg-clip-text text-transparent">
              {BRAND.name}
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm text-[color:var(--brand-text-dim)]">
            <NavLink href="/">For You</NavLink>
            <NavLink href="/discover">Discover</NavLink>
            <NavLink href="/watchlist">Watchlist</NavLink>
            {user.role === "owner" && <NavLink href="/admin">Admin</NavLink>}
          </nav>
          <button
            onClick={() => setPaletteOpen(true)}
            className="ml-auto flex items-center gap-2 rounded-md bg-black/40 hover:bg-black/60 border border-white/10 px-3 py-1.5 text-sm text-[color:var(--brand-text-dim)]"
          >
            <SearchIcon className="size-4" />
            <span className="hidden sm:inline">Search…</span>
            <kbd className="hidden sm:inline ml-2 text-[10px] rounded bg-white/10 px-1 py-0.5">⌘K</kbd>
          </button>
          <Link
            href="/discover/surprise"
            className="hidden sm:inline-flex items-center gap-1 text-sm text-[color:var(--brand-primary)] hover:underline"
          >
            <Wand2 className="size-4" />
            Surprise me
          </Link>
          <UserMenu user={user} />
        </div>
      </header>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }): React.ReactElement {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-md hover:bg-white/5 hover:text-[color:var(--brand-text)]"
    >
      {children}
    </Link>
  );
}
