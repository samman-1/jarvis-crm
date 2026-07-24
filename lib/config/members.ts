/**
 * The three people who use this system.
 *
 * This is the ONLY place team members are defined. Changing a name, a colour,
 * or a password here changes it everywhere in the app.
 *
 * Passwords are scrypt hashes in `salt:hash` form — never plaintext.
 * Each member's password can be overridden in production without a code change
 * by setting JARVIS_PASSWORD_1 / _2 / _3 to a *plaintext* password in the
 * environment (Vercel → Settings → Environment Variables). When that variable
 * is present it wins over the hash below.
 *
 * Generate a new hash with:  node scripts/hash-password.mjs "my new password"
 */

export interface MemberConfig {
  id: string;
  /** 1, 2 or 3 — the number on the login tile. */
  slot: 1 | 2 | 3;
  name: string;
  nameAr: string;
  /** Used for the Phase B Supabase Auth mapping. Never shown in the UI. */
  email: string;
  phone: string;
  /** Distinguishes this member everywhere they appear: badges, calendar, charts. */
  color: string;
  initials: string;
  /** Planned field-day window, local Riyadh time. */
  plannedStart: string;
  plannedEnd: string;
  /** scrypt `salt:hash`. Default is the temporary password noted alongside. */
  passwordHash: string;
  /** Name of the env var that overrides the hash with a plaintext password. */
  passwordEnvVar: string;
}

export const MEMBERS: MemberConfig[] = [
  {
    id: "m1",
    slot: 1,
    name: "Ehano",
    nameAr: "إيهانو",
    email: "ehano@jarvis.agency",
    phone: "",
    color: "#f36c34",
    initials: "EH",
    plannedStart: "09:00",
    plannedEnd: "14:00",
    // temporary password: jarvis1
    passwordHash:
      "8f2d9708e6c6d342066795e7cd493b76:ffdc766dda96f9c88d868dbb6492d12adb2234d84f10d849ae5eaabecdde078c",
    passwordEnvVar: "JARVIS_PASSWORD_1",
  },
  {
    id: "m2",
    slot: 2,
    name: "Sammoni",
    nameAr: "سموني",
    email: "sammoni@jarvis.agency",
    phone: "",
    color: "#58a2e6",
    initials: "SA",
    plannedStart: "09:00",
    plannedEnd: "14:00",
    // temporary password: jarvis2
    passwordHash:
      "829c551df1c068db46ab51f4c9e6d36d:ff1607ce59278440be909e55d3ca7fedc5e168c9164095496a88787fffcb5438",
    passwordEnvVar: "JARVIS_PASSWORD_2",
  },
  {
    id: "m3",
    slot: 3,
    name: "Aboodi",
    nameAr: "عبودي",
    email: "aboodi@jarvis.agency",
    phone: "",
    color: "#46bd82",
    initials: "AB",
    plannedStart: "09:00",
    plannedEnd: "14:00",
    // temporary password: jarvis3
    passwordHash:
      "39d951d8344ccb9685d34a4296b7116b:df3e5abd30f890bac79a63787ea56b60aa3729f55550a77982ff1f0d65ee4604",
    passwordEnvVar: "JARVIS_PASSWORD_3",
  },
];

/** Members without anything secret — safe to send to the browser. */
export type PublicMember = Omit<
  MemberConfig,
  "passwordHash" | "passwordEnvVar" | "email"
>;

export function toPublicMember(m: MemberConfig): PublicMember {
  const { passwordHash: _h, passwordEnvVar: _e, email: _m, ...rest } = m;
  return rest;
}

export const PUBLIC_MEMBERS: PublicMember[] = MEMBERS.map(toPublicMember);

export function getMember(id: string): MemberConfig | undefined {
  return MEMBERS.find((m) => m.id === id);
}

export function getMemberBySlot(slot: number): MemberConfig | undefined {
  return MEMBERS.find((m) => m.slot === slot);
}

export function memberName(id: string): string {
  return getMember(id)?.name ?? "Unknown";
}

export function memberColor(id: string): string {
  return getMember(id)?.color ?? "var(--muted)";
}

/**
 * How a member is named in warnings and logs.
 *
 * Just the name — we used to append "(#1)" but with only three people the
 * numbers were noise once the real names were in.
 */
export function memberLabel(id: string): string {
  return getMember(id)?.name ?? "Unknown";
}
