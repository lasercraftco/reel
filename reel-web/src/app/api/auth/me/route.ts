import { NextResponse } from "next/server";

import { readSessionFromCookie } from "@/lib/auth/session";

export async function GET(): Promise<NextResponse> {
  const user = await readSessionFromCookie();
  return NextResponse.json({ user });
}
