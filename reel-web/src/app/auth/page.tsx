import { Suspense } from "react";
import { readSessionFromCookie } from "@/lib/auth/session";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/auth/sign-in-form";

export default async function AuthPage(): Promise<React.ReactElement> {
  const user = await readSessionFromCookie();
  if (user) redirect("/");
  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-[color:var(--brand-surface)] p-8 border border-white/5">
        <h1 className="text-2xl font-semibold mb-1">Sign in</h1>
        <p className="text-sm text-[color:var(--brand-text-dim)] mb-6">
          We'll email you a magic link. No password needed.
        </p>
        <Suspense>
          <SignInForm />
        </Suspense>
      </div>
    </main>
  );
}
