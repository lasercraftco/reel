"use client";

import { useState } from "react";
import { toast } from "sonner";

export function SignInForm(): React.ReactElement {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data: { ok: boolean; sent: boolean; devLink?: string; error?: string } = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "failed");
      setSent(true);
      if (data.devLink) setDevLink(data.devLink);
      toast.success(data.sent ? "Magic link sent — check your email." : "Magic link generated (SMTP not configured).");
    } catch (err) {
      toast.error("Couldn't send magic link.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-3">
        <p className="text-sm">Check your email for the sign-in link.</p>
        {devLink && (
          <div className="rounded-md bg-black/40 p-3 text-xs">
            <div className="text-[color:var(--brand-text-faint)] mb-1">Dev mode (no SMTP):</div>
            <a className="break-all underline text-[color:var(--brand-accent)]" href={devLink}>
              {devLink}
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full rounded-md bg-black/30 border border-white/10 px-3 py-2 outline-none focus:border-[color:var(--brand-primary)]"
      />
      <button type="submit" disabled={submitting} className="brand-button-primary w-full">
        {submitting ? "Sending…" : "Send magic link"}
      </button>
    </form>
  );
}
