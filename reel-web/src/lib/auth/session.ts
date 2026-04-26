/**
 * Server-only helpers for reading the current user from a request.
 *
 * Cookie-based (HttpOnly, secure, SameSite=Lax, domain=.tyflix.net) so the
 * same login session works across reel + genome + karaoke subdomains.
 */

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

import { verifyToken, type TyflixClaims } from "./jwt";

export const COOKIE_NAME = process.env.TYFLIX_AUTH_COOKIE_NAME ?? "tyflix_auth";
export const COOKIE_DOMAIN = process.env.TYFLIX_AUTH_COOKIE_DOMAIN ?? ".tyflix.net";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: "owner" | "trusted" | "friend" | "guest";
  blocked: boolean;
};

export async function readSessionFromCookie(): Promise<SessionUser | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return await sessionUserFromToken(raw);
}

export async function sessionUserFromToken(token: string): Promise<SessionUser | null> {
  const claims = await verifyToken(token);
  if (!claims) return null;
  const row = (
    await db.select().from(users).where(eq(users.id, claims.sub)).limit(1)
  )[0];
  if (!row || row.blocked) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatarUrl,
    role: row.role as SessionUser["role"],
    blocked: row.blocked,
  };
}

export function buildClaims(user: SessionUser): TyflixClaims {
  return {
    sub: user.id,
    email: user.email,
    name: user.name ?? undefined,
    role: user.role,
    app: "reel",
  };
}

export function requireRole(
  user: SessionUser | null,
  ...accepted: Array<SessionUser["role"]>
): SessionUser {
  if (!user) throw new AuthError("not_signed_in", 401);
  if (!accepted.includes(user.role)) throw new AuthError("forbidden", 403);
  return user;
}

export class AuthError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}
