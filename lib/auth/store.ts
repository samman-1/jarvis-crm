import "server-only";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Where a member's own password lives once they have set one.
 *
 * The three passwords that ship with a deployment are environment variables,
 * which means Sammoni can see them and nobody else can change them. That was
 * fine for handing the system out; it is not fine permanently. Once someone
 * sets their own password here, it is a scrypt hash in the database that
 * nobody, including whoever runs the deployment, can read back.
 *
 * The environment variable stays as the fallback, so a member who has never
 * changed theirs still gets in, and so a database outage cannot lock out the
 * whole team.
 */

const SCRYPT_KEY_LENGTH = 64;

function admin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** `scrypt$salt$hash`, both hex. Self-describing so the format can change. */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(plain, salt, SCRYPT_KEY_LENGTH).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function matchesHash(plain: string, stored: string): boolean {
  const [scheme, salt, expected] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !expected) return false;
  const derived = scryptSync(plain, salt, SCRYPT_KEY_LENGTH);
  const expectedBuf = Buffer.from(expected, "hex");
  if (expectedBuf.length !== derived.length) return false;
  return timingSafeEqual(derived, expectedBuf);
}

/**
 * The member's stored hash, or null if they have never set one.
 *
 * A database error is treated the same as "never set one" on purpose: the
 * environment fallback then applies and people can still sign in.
 */
export async function readPasswordHash(
  memberId: string,
): Promise<string | null> {
  const sb = admin();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from("member_profiles")
      .select("password_hash")
      .eq("member_id", memberId)
      .maybeSingle();
    if (error) return null;
    const hash = (data as { password_hash?: string } | null)?.password_hash;
    return hash ? hash : null;
  } catch {
    return null;
  }
}

/** True when the new password was stored. False means nothing changed. */
export async function writePasswordHash(
  memberId: string,
  hash: string,
): Promise<boolean> {
  const sb = admin();
  if (!sb) return false;
  const { error } = await sb
    .from("member_profiles")
    .upsert(
      { member_id: memberId, password_hash: hash, updated_at: new Date().toISOString() },
      { onConflict: "member_id" },
    );
  return !error;
}
