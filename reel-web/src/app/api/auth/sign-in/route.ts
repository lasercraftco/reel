import { NextResponse } from "next/server";
import { z } from "zod";

import { issueMagicLink } from "@/lib/auth/magic-link";

const Body = z.object({ email: z.string().email() });

export async function POST(req: Request): Promise<NextResponse> {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }
  try {
    const { url, sent } = await issueMagicLink(parsed.data.email);
    return NextResponse.json({
      ok: true,
      sent,
      // expose the URL only when SMTP isn't configured (single-tenant homelab)
      devLink: sent ? undefined : url,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 500 });
  }
}
