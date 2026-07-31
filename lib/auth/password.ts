import { timingSafeEqual } from "node:crypto";
import type { MemberConfig } from "@/lib/config/members";
import { matchesHash, readPasswordHash } from "@/lib/auth/store";

/**
 * Password checking. Node runtime only, never import this from proxy.ts.
 *
 * Two sources, in order:
 *
 *   1. The hash the member set for themselves, in the database. Once this
 *      exists it is the only thing that works, so changing your password
 *      really does retire the one you were handed.
 *   2. JARVIS_PASSWORD_1 / _2 / _3 from the environment, for anyone who has
 *      not set their own yet.
 *
 * Nothing is stored in the repository, because the repository is public.
 *
 * This fails closed: with no stored hash and no environment variable, that
 * member cannot sign in. An unconfigured deployment locks everyone out rather
 * than falling back to something guessable.
 */
export async function verifyPassword(
  member: MemberConfig,
  attempt: string,
): Promise<boolean> {
  if (!attempt) return false;

  const stored = await readPasswordHash(member.id);
  if (stored) return matchesHash(attempt, stored);

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
