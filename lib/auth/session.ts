import type { SessionUser } from "@/lib/types";

/**
 * Session cookie: `base64url(payload).base64url(hmac)`.
 *
 * Signed and verified with Web Crypto rather than node:crypto so the exact
 * same code runs in middleware (Edge runtime) and in route handlers (Node).
 */

export const SESSION_COOKIE = "jarvis_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 14; // two weeks

interface SessionPayload extends SessionUser {
  /** Expiry, seconds since epoch. */
  exp: number;
}

function secret(): string {
  const value = process.env.JARVIS_SESSION_SECRET;
  if (value && value.length >= 16) return value;
  // Development fallback. In production, set JARVIS_SESSION_SECRET in Vercel —
  // without it, sessions signed by one deployment stay valid on the next.
  return "jarvis-dev-secret-change-me-in-production";
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): Uint8Array<ArrayBuffer> {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function key(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signSession(user: SessionUser): Promise<string> {
  const payload: SessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign(
    "HMAC",
    await key(),
    new TextEncoder().encode(body),
  );
  return `${body}.${toBase64Url(new Uint8Array(sig))}`;
}

export async function verifySession(
  token: string | undefined,
): Promise<SessionUser | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await key(),
      fromBase64Url(sig),
      new TextEncoder().encode(body),
    );
    if (!valid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(body)),
    ) as SessionPayload;

    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;

    return {
      id: payload.id,
      slot: payload.slot,
      name: payload.name,
      role: payload.role,
    };
  } catch {
    return null;
  }
}
