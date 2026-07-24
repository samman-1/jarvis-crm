#!/usr/bin/env node
/**
 * Generates a scrypt hash for lib/config/members.ts.
 *
 *   node scripts/hash-password.mjs "the new password"
 *
 * Paste the printed `salt:hash` string into that member's `passwordHash`.
 * Alternatively, skip this entirely and set JARVIS_PASSWORD_1/2/3 in the
 * environment to a plaintext password — that takes priority over the hash.
 */
import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/hash-password.mjs "your password"');
  process.exit(1);
}

if (password.length < 6) {
  console.error("Use at least 6 characters.");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 32).toString("hex");

console.log(`${salt}:${hash}`);
