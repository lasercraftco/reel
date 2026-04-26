import Link from "next/link";

export default function NotFound(): React.ReactElement {
  return (
    <main className="min-h-dvh flex items-center justify-center px-6 text-center">
      <div>
        <div className="text-6xl font-semibold tracking-tight bg-gradient-to-r from-[color:var(--brand-primary)] to-[color:var(--brand-accent)] bg-clip-text text-transparent">
          Out of frame
        </div>
        <p className="mt-3 text-[color:var(--brand-text-dim)]">That movie isn't anywhere in the catalog.</p>
        <Link href="/" className="mt-6 inline-block brand-button-primary">
          Back home
        </Link>
      </div>
    </main>
  );
}
