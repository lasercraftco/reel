/**
 * Magic-link issuance + redemption.
 *
 * Email -> token -> hashed in DB -> redeem with raw token from URL ->
 * upsert user (auto-create at role=friend, owner email auto-promoted) ->
 * mint JWT cookie.
 */

import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { magicLinks, users, auditLog } from "@/lib/db/schema";
import { issueToken } from "./jwt";
import { buildClaims, type SessionUser } from "./session";

const OWNER_EMAIL = (process.env.TYFLIX_OWNER_EMAIL ?? "tylerheon@gmail.com").toLowerCase();
const PUBLIC_URL = process.env.REEL_PUBLIC_URL ?? "http://localhost:3033";
const TOKEN_TTL_MIN = 20;

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function issueMagicLink(emailRaw: string): Promise<{ url: string; sent: boolean }> {
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("invalid_email");
  }
  const token = crypto.randomBytes(24).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MIN * 60_000);
  await db.insert(magicLinks).values({ email, tokenHash, expiresAt });

  const url = `${PUBLIC_URL}/auth/callback?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
  const sent = await sendMagicLinkEmail(email, url);
  return { url, sent };
}

async function sendMagicLinkEmail(email: string, url: string): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  if (!host) {
    console.warn(`[reel/magic-link] SMTP not configured — copy this link manually: ${url}`);
    return false;
  }
  const transport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM ?? "Reel <noreply@tyflix.net>",
    to: email,
    subject: "Sign in to Reel",
    text: `Click to sign in: ${url}\n\nThis link expires in ${TOKEN_TTL_MIN} minutes.`,
    html: `<p>Click to sign in:</p><p><a href="${url}">Open Reel</a></p><p style="color:#888;font-size:12px">This link expires in ${TOKEN_TTL_MIN} minutes.</p>`,
  });
  return true;
}

export async function redeemMagicLink(emailRaw: string, token: string): Promise<{ user: SessionUser; jwt: string }> {
  const email = emailRaw.trim().toLowerCase();
  const tokenHash = hashToken(token);

  const row = (
    await db
      .select()
      .from(magicLinks)
      .where(
        and(
          eq(magicLinks.email, email),
          eq(magicLinks.tokenHash, tokenHash),
          gt(magicLinks.expiresAt, new Date()),
          isNull(magicLinks.consumedAt),
        ),
      )
      .limit(1)
  )[0];

  if (!row) throw new Error("invalid_or_expired_link");

  await db.update(magicLinks).set({ consumedAt: new Date() }).where(eq(magicLinks.id, row.id));

  // upsert user
  const existing = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
  let userRow = existing;
  if (!userRow) {
    const role = email === OWNER_EMAIL ? "owner" : "friend";
    const inserted = await db
      .insert(users)
      .values({ email, role, name: email.split("@")[0] })
      .returning();
    userRow = inserted[0];
    await db.insert(auditLog).values({
      userId: userRow.id,
      action: "user.created",
      target: email,
      metadata: { role, source: "magic_link" },
    });
  } else if (existing && existing.email === OWNER_EMAIL && existing.role !== "owner") {
    await db.update(users).set({ role: "owner" }).where(eq(users.id, existing.id));
    userRow = { ...existing, role: "owner" };
  }

  await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, userRow.id));

  if (userRow.blocked) throw new Error("blocked");

  const sessionUser: SessionUser = {
    id: userRow.id,
    email: userRow.email,
    name: userRow.name,
    avatarUrl: userRow.avatarUrl,
    role: userRow.role as SessionUser["role"],
    blocked: userRow.blocked,
  };
  const jwt = await issueToken(buildClaims(sessionUser));

  await db.insert(auditLog).values({
    userId: userRow.id,
    action: "user.signin",
    target: email,
    metadata: {},
  });

  return { user: sessionUser, jwt };
}
