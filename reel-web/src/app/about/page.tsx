import Link from "next/link";

import { BRAND } from "@/lib/brand";

export default function AboutPage(): React.ReactElement {
  return (
    <main className="min-h-dvh max-w-2xl mx-auto px-6 py-16 space-y-6">
      <h1 className="text-3xl font-semibold">{BRAND.name}</h1>
      <p className="text-[color:var(--brand-text-dim)]">{BRAND.description}</p>
      <p className="text-sm text-[color:var(--brand-text-faint)]">
        Built by Tyler · runs on the {BRAND.domain} homelab · part of the Tyflix family alongside
        Genome (music) and Karaoke. Single sign-on across all three.
      </p>
      <Link href="/" className="brand-button-primary inline-block">Home</Link>
    </main>
  );
}
