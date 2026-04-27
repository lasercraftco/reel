"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

type User = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  daily_quota: number;
};

export function QuotasTable({ initial }: { initial: User[] }): React.ReactElement {
  const [rows, setRows] = useState<User[]>(initial);

  async function updateQuota(userId: string, newQuota: number): Promise<void> {
    try {
      const res = await fetch(`/api/engine/admin/users/${userId}/quota`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ daily_request_quota: newQuota }),
      });
      if (!res.ok) {
        toast.error("Failed to update quota");
        return;
      }
      const updated = (await res.json()) as { daily_request_quota: number };
      setRows((rs) =>
        rs.map((r) =>
          r.id === userId ? { ...r, daily_quota: updated.daily_request_quota } : r
        )
      );
      toast.success("Quota updated");
    } catch (err) {
      console.error(err);
      toast.error("Error updating quota");
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/5">
      <table className="w-full text-sm">
        <thead className="text-xs text-[color:var(--brand-text-faint)] bg-black/40">
          <tr>
            <Th>User</Th>
            <Th>Current Quota</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((r) => (
            <QuotaRow key={r.id} user={r} onUpdate={updateQuota} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuotaRow({
  user,
  onUpdate,
}: {
  user: User;
  onUpdate: (userId: string, quota: number) => Promise<void>;
}): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const [tempQuota, setTempQuota] = useState(String(user.daily_quota));
  const [saving, setSaving] = useState(false);

  async function save(): Promise<void> {
    const newQuota = parseInt(tempQuota, 10);
    if (isNaN(newQuota) || newQuota < 0) {
      toast.error("Invalid quota");
      return;
    }
    setSaving(true);
    try {
      await onUpdate(user.id, newQuota);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr>
      <Td>
        <div>{user.email}</div>
        <div className="text-xs text-[color:var(--brand-text-faint)]">{user.name || "—"}</div>
      </Td>
      <Td>
        {editing ? (
          <input
            type="number"
            value={tempQuota}
            onChange={(e) => setTempQuota(e.target.value)}
            className="w-20 rounded bg-white/5 border border-white/10 px-2 py-1 text-sm"
            min="0"
          />
        ) : (
          <span className="text-base font-medium">{user.daily_quota}</span>
        )}
      </Td>
      <Td>
        {editing ? (
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="brand-button-primary text-xs flex items-center gap-1"
            >
              {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/5"
          >
            Edit
          </button>
        )}
      </Td>
    </tr>
  );
}

function Th({ children }: { children: React.ReactNode }): React.ReactElement {
  return <th className="text-left font-medium px-4 py-3">{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }): React.ReactElement {
  return <td className={`px-4 py-3 ${className ?? ""}`}>{children}</td>;
}
