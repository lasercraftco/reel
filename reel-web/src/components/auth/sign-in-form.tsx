"use client";

import { useState } from "react";
import { toast } from "sonner";

interface SignInFormProps {
  next?: string;
}

export function SignInForm({ next }: SignInFormProps): React.ReactElement {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, next }),
      });
      const data: { ok: boolean; next?: string; error?: string } = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "failed");
      toast.success("Signed in.");
      window.location.href = data.next ?? "/";
    } catch (err) {
      toast.error("Couldn't sign you in. Try a simpler name.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        type="text"
        autoComplete="given-name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter your first name"
        autoFocus
        className="w-full rounded-md bg-black/30 border border-white/10 px-3 py-2 outline-none focus:border-[color:var(--brand-primary)]"
      />
      <button type="submit" disabled={submitting} className="brand-button-primary w-full">
        {submitting ? "Signing in…" : "Continue"}
      </button>
    </form>
  );
}
