import { NextResponse } from "next/server";

import { redeemMagicLink } from "@/lib/auth/magic-link";
import { COOKIE_DOMAIN, COOKIE_NAME } from "@/lib/auth/session";

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const email = url.searchParams.get("email");
  const token = url.searchParams.get("token");
  if (!email || !token) {
    return NextResponse.redirect(new URL("/auth?error=missing", url));
  }
  try {
    const { jwt } = await redeemMagicLink(email, token);
    const res = NextResponse.redirect(new URL("/", url));
    const isProd = process.env.NODE_ENV === "production";
    res.cookies.set({
      name: COOKIE_NAME,
      value: jwt,
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      domain: isProd ? COOKIE_DOMAIN : undefined,
      path: "/",
      maxAge: Number(process.env.TYFLIX_AUTH_TOKEN_TTL_SECONDS ?? 60 * 60 * 24 * 30),
    });
    return res;
  } catch (err) {
    console.error("[reel/auth/callback]", err);
    return NextResponse.redirect(new URL("/auth?error=invalid", url));
  }
}
