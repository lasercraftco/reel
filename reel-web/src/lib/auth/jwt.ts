/**
 * Shared JWT issuer + verifier for the tyflix family.
 *
 * The same TYFLIX_AUTH_JWT_SECRET (and TYFLIX_AUTH_JWT_ISSUER) must be set
 * in every reel / genome / karaoke deployment, so a session created in one
 * app verifies in all of them. Cookie domain is .tyflix.net.
 */

import { jwtVerify, SignJWT } from "jose";

const SECRET_RAW = process.env.TYFLIX_AUTH_JWT_SECRET;
if (!SECRET_RAW || SECRET_RAW === "change-me-to-a-random-64-byte-hex") {
  if (process.env.NODE_ENV === "production") {
    throw new Error("TYFLIX_AUTH_JWT_SECRET is required in production");
  }
}

const SECRET = new TextEncoder().encode(SECRET_RAW || "dev-only-do-not-use-in-prod");
const ISSUER = process.env.TYFLIX_AUTH_JWT_ISSUER ?? "tyflix.net";
const TTL = Number(process.env.TYFLIX_AUTH_TOKEN_TTL_SECONDS ?? 60 * 60 * 24 * 30);

export type TyflixClaims = {
  sub: string;        // user uuid
  email: string;
  name?: string;
  role: "owner" | "trusted" | "friend" | "guest";
  app: "reel" | "genome" | "karaoke";
};

export async function issueToken(claims: TyflixClaims): Promise<string> {
  return await new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience("tyflix")
    .setIssuedAt()
    .setExpirationTime(`${TTL}s`)
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<TyflixClaims | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, {
      issuer: ISSUER,
      audience: "tyflix",
    });
    return payload as unknown as TyflixClaims;
  } catch {
    return null;
  }
}
