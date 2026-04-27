import { Suspense } from "react";
import { readSessionFromCookie } from "@/lib/auth/session";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/auth/sign-in-form";

interface AuthPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const ERROR_COPY: Record<string, string> = {
  name_required: "Enter your first name to keep going.",
  invalid_name: "Try just letters and numbers.",
  blocked: "Your account is blocked. Reach out to Tyler.",
};

function asString(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AuthPage({ searchParams }: AuthPageProps): Promise<React.ReactElement> {
  const user = await readSessionFromCookie();
  if (user) redirect("/");
  const params = await searchParams;
  const error = asString(params.error);
  const next = asString(params.next);
  const errorMsg = error ? ERROR_COPY[error] ?? error : null;
  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-[color:var(--brand-surface)] p-8 border border-white/5">
        <h1 className="text-2xl font-semibold mb-1">Sign in</h1>
        <p className="text-sm text-[color:var(--brand-text-dim)] mb-6">
          Just your first name &mdash; same name across Reel, Genome, and Karaoke.
        </p>
        {errorMsg && (
          <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            {errorMsg}
          </div>
        )}
        <Suspense>
          <SignInForm next={next} />
        </Suspense>
      </div>
    </main>
  );
}
