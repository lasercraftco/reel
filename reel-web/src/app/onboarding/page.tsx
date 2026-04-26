import { redirect } from "next/navigation";

import { readSessionFromCookie } from "@/lib/auth/session";
import { TopBar } from "@/components/layout/top-bar";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export default async function OnboardingPage(): Promise<React.ReactElement> {
  const user = await readSessionFromCookie();
  if (!user) redirect("/auth?next=/onboarding");
  return (
    <main className="min-h-dvh">
      <TopBar user={user} />
      <section className="px-4 sm:px-6 lg:px-10 pb-20 max-w-3xl mx-auto pt-6">
        <h1 className="text-3xl font-semibold mb-2">Welcome to Reel</h1>
        <p className="text-[color:var(--brand-text-dim)] mb-8">
          Pick five movies you love so we can seed your taste.
        </p>
        <OnboardingFlow userId={user.id} />
      </section>
    </main>
  );
}
