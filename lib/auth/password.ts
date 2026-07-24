import { scryptSync, timingSafeEqual } from "node:crypto";
import type { MemberConfig } from "@/lib/config/members";

/**
 * Password checking. Node runtime only — never import this from middleware.
 *
 * Two sources, in order:
 *   1. The member's env var (JARVIS_PASSWORD_1/2/3) holding a plaintext
 *      password. This is how a password gets changed in production without a
 *      code change: set it in Vercel and redeploy.
 *   2. The scrypt hash committed in lib/config/members.ts.
 */
export function verifyPassword(member: MemberConfig, attempt: string): boolean {
  if (!attempt) return false;

  const override = process.env[member.passwordEnvVar];
  if (override) return safeEqualStrings(override, attempt);

  const [salt, expected] = member.passwordHash.split(":");
  if (!salt || !expected) return false;

  const actual = scryptSync(attempt, salt, 32);
  const expectedBuf = Buffer.from(expected, "hex");
  if (actual.length !== expectedBuf.length) return false;
  return timingSafeEqual(actual, expectedBuf);
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
