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
  username: string;
  displayName: string | null;
  isOwner: boolean;
};

export async function readSessionFromCookie(): Promise<SessionUser | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return await sessionUserFromToken(raw);
}

/**
 * Resolve (or auto-create) a user from JWT claims. Used when the SSO cookie
 * was issued by a sibling tyflix app for a username this reel DB hasn't
 * seen yet.
 */
async function findOrCreateByUsername(username: string, displayName?: string): Promise<SessionUser | null> {
  const existing = (await db.select().from(users).where(eq(users.username, username)).limit(1))[0];
  if (existing) return mapRow(existing);
  const isOwner = username === (process.env.TYFLIX_OWNER_USERNAME ?? "tyler").toLowerCase();
  const inserted = (
    await db
      .insert(users)
      .values({
        username,
        displayName: displayName ?? username,
        isOwner,
        name: displayName ?? username,
        role: isOwner ? "owner" : "friend",
      })
      .returning()
  )[0];
  return mapRow(inserted);
}

function mapRow(row: typeof users.$inferSelect): SessionUser {
  return {
    id: row.id,
    email: row.email ?? "",
    name: row.displayName ?? row.name ?? row.username,
    avatarUrl: row.avatarUrl,
    role: row.role as SessionUser["role"],
    blocked: row.blocked,
    username: row.username,
    displayName: row.displayName ?? null,
    isOwner: row.isOwner ?? false,
  };
}

export async function sessionUserFromToken(token: string): Promise<SessionUser | null> {
  const claims = await verifyToken(token);
  if (!claims) return null;
  // First-name SSO: claims.sub is the username slug.
  // Try by username; fall back to legacy id-based lookup (only if sub looks
  // like a UUID, since users.id is a uuid column); auto-create if missing.
  const sub = String(claims.sub);
  let row = (await db.select().from(users).where(eq(users.username, sub)).limit(1))[0];
  if (!row && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sub)) {
    try {
      row = (await db.select().from(users).where(eq(users.id, sub)).limit(1))[0];
    } catch {
      row = undefined as any;
    }
  }
  if (!row) {
    // first sight of this user in reel — auto-create from the SSO claim
    const display = (typeof claims.name === "string" && claims.name) || sub;
    return await findOrCreateByUsername(sub, display);
  }
  if (row.blocked) return null;
  return mapRow(row);
}

export function buildClaims(user: SessionUser): TyflixClaims {
  return {
    sub: user.username,
    name: user.displayName ?? user.name ?? user.username,
    isOwner: user.isOwner === true || user.role === "owner",
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
