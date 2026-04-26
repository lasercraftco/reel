import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, app: "reel-web", ts: new Date().toISOString() });
}
