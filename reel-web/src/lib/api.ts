/**
 * Server-side fetcher that calls the FastAPI engine with the user's JWT
 * forwarded as a Bearer token. Browser-side fetches go through Next's
 * /api/engine/* rewrite (which forwards cookies → engine).
 */

import { cookies } from "next/headers";

const ENGINE_URL = process.env.REEL_ENGINE_INTERNAL_URL ?? process.env.REEL_ENGINE_URL ?? "http://localhost:8002";
const COOKIE_NAME = process.env.TYFLIX_AUTH_COOKIE_NAME ?? "tyflix_auth";

export class ApiError extends Error {
  constructor(message: string, public status: number, public body: unknown) {
    super(message);
  }
}

export async function engine<T>(path: string, init: RequestInit = {}): Promise<T> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("content-type") && init.body) headers.set("content-type", "application/json");
  const res = await fetch(`${ENGINE_URL}${path}`, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(`engine ${res.status} ${path}`, res.status, body);
  }
  return (await res.json()) as T;
}
