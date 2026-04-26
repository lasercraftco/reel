"use client";

import { useEffect } from "react";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }): React.ReactElement {
  useEffect(() => {
    console.error("[reel/error]", error);
  }, [error]);
  return (
    <main className="min-h-dvh flex items-center justify-center px-6 text-center">
      <div>
        <div className="text-3xl font-semibold mb-2">Reel hit a bad reel</div>
        <p className="text-[color:var(--brand-text-dim)] max-w-md">{error.message}</p>
        <button onClick={reset} className="mt-6 brand-button-primary">Try again</button>
      </div>
    </main>
  );
}
