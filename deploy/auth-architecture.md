# Tyflix family SSO

Reel + Genome + Karaoke share a single sign-on session via a JWT cookie issued
under `.tyflix.net`. Sign in once at any of them and the cookie is sent to all.

## How it works

1. **Shared secret.** `TYFLIX_AUTH_JWT_SECRET` (HS256, 64-byte hex) lives in
   `~/homelab/.env` and is injected into every app's container via `env_file`.
2. **Cookie.** Reel sets `tyflix_auth=<jwt>; Domain=.tyflix.net; HttpOnly;
   Secure; SameSite=Lax; Path=/; Max-Age=2592000` on successful magic-link
   redemption (`/auth/callback`). Browsers send it to every subdomain.
3. **Verification.** Each app verifies the JWT with the shared secret. Claims
   include `sub` (user uuid), `email`, `role`, and `app` (the issuer surface).
4. **Roles.** `owner | trusted | friend | guest`. Owner is auto-promoted on
   first sign-in if email matches `TYFLIX_OWNER_EMAIL`. Friends are the
   default.
5. **User record.** Each app keeps its own `users` table (so per-app data
   stays scoped), keyed on the email. The first time a user signs in to a new
   app the row is auto-created with `role=friend` (or `owner` if email matches).
6. **Engine auth.** The FastAPI engines verify the JWT via `Authorization:
   Bearer <jwt>` header, which the Next.js server forwards from the cookie.

## To wire Genome and Karaoke

Both apps already use the same Postgres + Drizzle pattern. Steps:

1. Add the same `TYFLIX_AUTH_*` env vars to their `.env`.
2. Copy `reel-web/src/lib/auth/jwt.ts`, `auth/session.ts`, `auth/magic-link.ts`,
   and `middleware.ts` (renaming the rewrite path / cookie consts as needed).
3. Add the same Drizzle tables (`users`, `magic_links`, `sessions`,
   `audit_log`).
4. Add the matching FastAPI `auth.py` to their engines.

Once that's done, signing in to any of the three sets the cookie at
`.tyflix.net` and the user is signed in to all three. We left a `// TODO:
shared package` marker so this code can be lifted into a `@tyflix/auth` npm
package + `tyflix-auth` Python package once duplication becomes painful.
