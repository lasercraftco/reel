"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { LogOut, Settings, Shield, User as UserIcon, Bookmark, Inbox } from "lucide-react";

import type { SessionUser } from "@/lib/types";

export function UserMenu({ user }: { user: SessionUser }): React.ReactElement {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="size-9 rounded-full bg-[color:var(--brand-surface-2)] flex items-center justify-center hover:ring-2 hover:ring-[color:var(--brand-primary)]">
          <span className="text-sm font-semibold">
            {(user.name?.[0] || user.email[0] || "?").toUpperCase()}
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-[220px] rounded-lg bg-[color:var(--brand-surface)] border border-white/10 shadow-2xl py-1 text-sm"
        >
          <div className="px-3 py-2 text-xs text-[color:var(--brand-text-faint)]">
            <div className="text-[color:var(--brand-text)]">{user.name || user.email}</div>
            <div className="text-[10px] uppercase tracking-wider mt-0.5">{user.role}</div>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-white/5" />
          <Item href="/watchlist" icon={<Bookmark className="size-4" />}>Watchlist</Item>
          <Item href="/account/requests" icon={<Inbox className="size-4" />}>My Library Activity</Item>
          <Item href="/account" icon={<Settings className="size-4" />}>Settings</Item>
          {user.role === "owner" && (
            <Item href="/admin" icon={<Shield className="size-4" />}>Admin</Item>
          )}
          <DropdownMenu.Separator className="my-1 h-px bg-white/5" />
          <SignOutItem />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function Item({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <DropdownMenu.Item asChild>
      <Link
        href={href}
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 outline-none cursor-pointer"
      >
        {icon}
        {children}
      </Link>
    </DropdownMenu.Item>
  );
}

function SignOutItem(): React.ReactElement {
  async function signOut(): Promise<void> {
    await fetch("/api/auth/sign-out", { method: "POST" });
    window.location.href = "/";
  }
  return (
    <DropdownMenu.Item
      onSelect={signOut}
      className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 outline-none cursor-pointer text-[color:var(--brand-down)]"
    >
      <LogOut className="size-4" />
      Sign out
    </DropdownMenu.Item>
  );
}
