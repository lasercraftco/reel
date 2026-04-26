import { redirect } from "next/navigation";

import { readSessionFromCookie } from "@/lib/auth/session";
import { TopBar } from "@/components/layout/top-bar";
import { AccountForm } from "@/components/account/account-form";

export default async function AccountPage(): Promise<React.ReactElement> {
  const user = await readSessionFromCookie();
  if (!user) redirect("/auth?next=/account");
  return (
    <main className="min-h-dvh">
      <TopBar user={user} />
      <section className="px-4 sm:px-6 lg:px-10 pb-20 max-w-2xl mx-auto pt-6 space-y-4">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <AccountForm user={user} />
      </section>
    </main>
  );
}
