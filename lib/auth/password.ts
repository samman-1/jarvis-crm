import { timingSafeEqual } from "node:crypto";
import type { MemberConfig } from "@/lib/config/members";

/**
 * Password checking. Node runtime only — never import this from proxy.ts.
 *
 * Passwords live ONLY in the environment: JARVIS_PASSWORD_1 / _2 / _3, set in
 * Vercel and in .env.local for development. Nothing is stored in the
 * repository, because the repository is public.
 *
 * This fails closed: if a member's variable is missing, that member cannot
 * sign in. An unconfigured deployment locks everyone out rather than falling
 * back to something guessable.
 */
export function verifyPassword(member: MemberConfig, attempt: string): boolean {
  if (!attempt) return false;

  const expected = process.env[member.passwordEnvVar];
  if (!expected) return false;

  return safeEqualStrings(expected, attempt);
}

/** True when the deployment has no passwords configured at all. */
export function isPasswordConfigured(member: MemberConfig): boolean {
  return Boolean(process.env[member.passwordEnvVar]);
}

function safeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still burn a comparison so length is not leaked by timing.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
