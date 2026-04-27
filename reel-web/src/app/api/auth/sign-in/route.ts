/**
 * First-name sign-in. Single text field. Slugifies the name into a stable
 * username, finds-or-creates the user, mints a Tyflix SSO JWT, sets the
 * shared cookie at .tyflix.net.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { users, auditLog } from "@/lib/db/schema";
import { issueToken, slugifyName, OWNER_USERNAME } from "@/lib/auth/jwt";
import { COOKIE_DOMAIN, COOKIE_NAME, buildClaims, type SessionUser } from "@/lib/auth/session";

const Body = z.object({
  name: z.string().trim().min(1).max(200),
  next: z.string().optional(),
});

export async function POST(req: Request): Promise<Response> {
  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  const isForm =
    ct.includes("application/x-www-form-urlencoded") ||
    ct.includes("multipart/form-data");

  let raw: unknown = null;
  try {
    if (isForm) {
      const fd = await req.formData();
      raw = Object.fromEntries(fd.entries());
    } else {
      raw = await req.json();
    }
  } catch {
    raw = null;
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    if (isForm) {
      const dest = new URL("/auth", req.url);
      dest.searchParams.set("error", "name_required");
      return NextResponse.redirect(dest, 303);
    }
    return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });
  }

  const display = parsed.data.name.trim().slice(0, 200);
  const username = slugifyName(display);
  if (!username) {
    if (isForm) {
      const dest = new URL("/auth", req.url);
      dest.searchParams.set("error", "invalid_name");
      return NextResponse.redirect(dest, 303);
    }
    return NextResponse.json({ ok: false, error: "invalid_name" }, { status: 400 });
  }

  // upsert by username
  let userRow = (await db.select().from(users).where(eq(users.username, username)).limit(1))[0];
  if (!userRow) {
    const isOwner = username === OWNER_USERNAME;
    const role = isOwner ? "owner" : "friend";
    const inserted = await db
      .insert(users)
      .values({
        username,
        displayName: display,
        isOwner,
        name: display,
        role,
      })
      .returning();
    userRow = inserted[0];
    await db.insert(auditLog).values({
      userId: userRow.id,
      action: "user.created",
      target: username,
      metadata: { role, source: "first_name_signin" },
    });
  } else {
    if (userRow.displayName !== display) {
      await db.update(users).set({ displayName: display, lastSeenAt: new Date() }).where(eq(users.id, userRow.id));
      userRow.displayName = display;
    } else {
      await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, userRow.id));
    }
  }

  if (userRow.blocked) {
    if (isForm) {
      const dest = new URL("/auth", req.url);
      dest.searchParams.set("error", "blocked");
      return NextResponse.redirect(dest, 303);
    }
    return NextResponse.json({ ok: false, error: "blocked" }, { status: 403 });
  }

  const sessionUser: SessionUser = {
    id: userRow.id,
    email: userRow.email ?? "",
    name: userRow.displayName ?? userRow.name ?? userRow.username,
    avatarUrl: userRow.avatarUrl,
    role: userRow.role as SessionUser["role"],
    blocked: userRow.blocked,
    username: userRow.username,
    displayName: userRow.displayName ?? null,
    isOwner: userRow.isOwner ?? false,
  };
  const jwt = await issueToken(buildClaims(sessionUser));

  await db.insert(auditLog).values({
    userId: userRow.id,
    action: "user.signin",
    target: username,
  });

  const next = parsed.data.next && parsed.data.next.startsWith("/") ? parsed.data.next : "/";
  const isProd = process.env.NODE_ENV === "production";
  const res = isForm
    ? NextResponse.redirect(new URL(next, req.url), 303)
    : NextResponse.json({ ok: true, user: sessionUser, next });
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
}
