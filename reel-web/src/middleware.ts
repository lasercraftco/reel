import { NextResponse, type NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";

const PUBLIC_PATHS = [
  "/",
  "/auth",
  "/auth/callback",
  "/api/auth/sign-in",
  "/api/auth/callback",
  "/api/auth/sign-out",
  "/api/healthz",
  "/_next",
  "/favicon",
  "/icon",
];

const COOKIE_NAME = process.env.TYFLIX_AUTH_COOKIE_NAME ?? "tyflix_auth";

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  const claims = await verifyToken(token);
  if (!claims) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "invalid_session" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    return NextResponse.redirect(url);
  }
  // Block admin pages for non-owners
  if (pathname.startsWith("/admin") && claims.role !== "owner") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const res = NextResponse.next();
  res.headers.set("x-reel-user-id", claims.sub);
  res.headers.set("x-reel-user-role", claims.role);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
