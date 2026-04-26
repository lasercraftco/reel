"use client";

import { useState } from "react";
import { toast } from "sonner";

type Row = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  blocked: boolean;
  daily_quota: number;
  created_at: string;
  last_seen_at: string | null;
};

const ROLES = ["owner", "trusted", "friend", "guest"];

export function UsersTable({ users }: { users: Row[] }): React.ReactElement {
  const [rows, setRows] = useState<Row[]>(users);

  async function update(id: string, patch: Partial<Row>): Promise<void> {
    const updated = rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
    setRows(updated);
    await fetch(`/api/engine/admin/users/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    toast.success("Saved");
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/5">
      <table className="w-full text-sm">
        <thead className="text-xs text-[color:var(--brand-text-faint)] bg-black/40">
          <tr>
            <Th>Email</Th>
            <Th>Role</Th>
            <Th>Daily quota</Th>
            <Th>Blocked</Th>
            <Th>Last seen</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((r) => (
            <tr key={r.id}>
              <Td>{r.email}</Td>
              <Td>
                <select
                  value={r.role}
                  onChange={(e) => update(r.id, { role: e.target.value })}
                  className="bg-black/30 border border-white/10 rounded-md px-2 py-1"
                >
                  {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </Td>
              <Td>
                <input
                  type="number"
                  min="0"
                  className="w-20 bg-black/30 border border-white/10 rounded-md px-2 py-1"
                  value={r.daily_quota}
                  onChange={(e) => update(r.id, { daily_quota: Number(e.target.value) })}
                />
              </Td>
              <Td>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={r.blocked} onChange={(e) => update(r.id, { blocked: e.target.checked })} />
                  {r.blocked ? "blocked" : "active"}
                </label>
              </Td>
              <Td>{r.last_seen_at ? new Date(r.last_seen_at).toLocaleString() : "—"}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }): React.ReactElement {
  return <th className="text-left font-medium px-4 py-3">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }): React.ReactElement {
  return <td className="px-4 py-3">{children}</td>;
}
