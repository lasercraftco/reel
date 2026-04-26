"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { SessionUser } from "@/lib/types";

export function AccountForm({ user }: { user: SessionUser }): React.ReactElement {
  const [familyFriendly, setFamilyFriendly] = useState(false);
  const [excludeWatched, setExcludeWatched] = useState(true);

  async function save(): Promise<void> {
    await fetch(`/api/engine/admin/users/${user.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ settings: { familyFriendly, excludeWatched } }),
    });
    toast.success("Saved");
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-[color:var(--brand-surface)] p-5 space-y-4">
      <Row label="Email">{user.email}</Row>
      <Row label="Role">{user.role}</Row>
      <label className="flex items-center justify-between">
        <span className="text-sm text-[color:var(--brand-text-dim)]">Family-friendly only (≤ PG-13)</span>
        <input type="checkbox" checked={familyFriendly} onChange={(e) => setFamilyFriendly(e.target.checked)} />
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm text-[color:var(--brand-text-dim)]">Exclude movies I've already watched (Plex)</span>
        <input type="checkbox" checked={excludeWatched} onChange={(e) => setExcludeWatched(e.target.checked)} />
      </label>
      <button onClick={save} className="brand-button-primary text-sm">Save</button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[color:var(--brand-text-faint)]">{label}</span>
      <span>{children}</span>
    </div>
  );
}
