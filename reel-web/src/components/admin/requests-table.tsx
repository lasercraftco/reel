"use client";

import Image from "next/image";
import { useState } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { tmdbImage } from "@/lib/utils";

type Req = {
  add_id: number;
  status: string;
  created_at: string;
  user: { id: string; email: string; role: string };
  movie: { id: number; title: string; poster_path: string | null; release_date: string | null };
  note: string | null;
};

export function RequestsTable({ initial }: { initial: Req[] }): React.ReactElement {
  const [rows, setRows] = useState<Req[]>(initial);
  const [busy, setBusy] = useState<number | null>(null);

  async function decide(addId: number, decision: "approved" | "rejected"): Promise<void> {
    setBusy(addId);
    try {
      const res = await fetch("/api/engine/library/decision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ add_id: addId, decision, actor_user_id: "owner" }),
      });
      const data = (await res.json()) as { status: string };
      setRows((rs) => rs.map((r) => (r.add_id === addId ? { ...r, status: data.status } : r)));
      toast.success(`${decision === "approved" ? "Approved" : "Rejected"}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/5">
      <table className="w-full text-sm">
        <thead className="text-xs text-[color:var(--brand-text-faint)] bg-black/40">
          <tr><Th>Movie</Th><Th>Requester</Th><Th>Status</Th><Th>Note</Th><Th>Actions</Th></tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((r) => (
            <tr key={r.add_id}>
              <Td>
                <div className="flex items-center gap-3">
                  <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded">
                    {r.movie.poster_path && (
                      <Image src={tmdbImage(r.movie.poster_path, "w92")!} alt={r.movie.title} fill className="object-cover" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{r.movie.title}</div>
                    <div className="text-xs text-[color:var(--brand-text-faint)]">{r.movie.release_date?.slice(0, 4) || "—"}</div>
                  </div>
                </div>
              </Td>
              <Td>
                <div>{r.user.email}</div>
                <div className="text-xs text-[color:var(--brand-text-faint)]">{r.user.role}</div>
              </Td>
              <Td><span className={`text-xs uppercase tracking-wider rounded px-2 py-0.5 ${badge(r.status)}`}>{r.status}</span></Td>
              <Td className="max-w-xs truncate">{r.note}</Td>
              <Td>
                {r.status === "requested" && (
                  <div className="flex gap-2">
                    <button onClick={() => decide(r.add_id, "approved")} disabled={busy === r.add_id} className="brand-button-primary text-xs flex items-center gap-1">
                      {busy === r.add_id ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} Approve
                    </button>
                    <button onClick={() => decide(r.add_id, "rejected")} disabled={busy === r.add_id} className="rounded-md border border-white/10 px-2 py-1 text-xs flex items-center gap-1 hover:bg-white/5">
                      <X className="size-3" /> Reject
                    </button>
                  </div>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function badge(status: string): string {
  if (status === "submitted" || status === "approved") return "bg-[color:var(--brand-up)]/15 text-[color:var(--brand-up)]";
  if (status === "rejected" || status === "failed") return "bg-[color:var(--brand-down)]/15 text-[color:var(--brand-down)]";
  if (status === "requested") return "bg-[color:var(--brand-warn)]/15 text-[color:var(--brand-warn)]";
  return "bg-white/5 text-[color:var(--brand-text-dim)]";
}

function Th({ children }: { children: React.ReactNode }): React.ReactElement {
  return <th className="text-left font-medium px-4 py-3">{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }): React.ReactElement {
  return <td className={`px-4 py-3 ${className ?? ""}`}>{children}</td>;
}
