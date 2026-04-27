/**
 * Shared JWT issuer + verifier for the tyflix family.
 *
 * The same TYFLIX_AUTH_JWT_SECRET (and TYFLIX_AUTH_JWT_ISSUER) must be set
 * in every reel / genome / karaoke deployment, so a session created in one
 * app verifies in all of them. Cookie domain is .tyflix.net.
 */

import { jwtVerify, SignJWT } from "jose";

// Lazy-init: do NOT throw at module load (build-time page data collection
// imports this file without env vars). Throw on first use instead.
let _secret: Uint8Array | null = null;
function secret(): Uint8Array {
  if (_secret) return _secret;
  const raw = process.env.TYFLIX_AUTH_JWT_SECRET ?? process.env.TYFLIX_PORTAL_JWT_SECRET;
  if (!raw || raw === "change-me-to-a-random-64-byte-hex") {
    if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
      throw new Error("TYFLIX_AUTH_JWT_SECRET is required in production");
    }
  }
  _secret = new TextEncoder().encode(raw || "dev-only-do-not-use-in-prod");
  return _secret;
}
const ISSUER = process.env.TYFLIX_AUTH_JWT_ISSUER ?? "tyflix.net";
const TTL = Number(process.env.TYFLIX_AUTH_TOKEN_TTL_SECONDS ?? 60 * 60 * 24 * 30);

export type TyflixClaims = {
  sub: string;            // username (slug). legacy tokens may carry a uuid here.
  name?: string;          // display name (first-name as typed)
  isOwner: boolean;
  app?: "reel" | "genome" | "karaoke" | "portal";
};

export async function issueToken(claims: TyflixClaims): Promise<string> {
  return await new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience("tyflix")
    .setIssuedAt()
    .setExpirationTime(`${TTL}s`)
    .sign(secret());
}

export async function verifyToken(token: string): Promise<TyflixClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience: "tyflix",
    });
    return payload as unknown as TyflixClaims;
  } catch {
    return null;
  }
}
// Appended to reel-web/src/lib/auth/jwt.ts:

/**
 * Slugify a first name into a stable username.
 * "Tyler" -> "tyler", " Anna-Marie " -> "annamarie"
 */
export function slugifyName(raw: string): string {
  return raw.normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 50);
}

export const OWNER_USERNAME = (process.env.TYFLIX_OWNER_USERNAME ?? "tyler").toLowerCase();
