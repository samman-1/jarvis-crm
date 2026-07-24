/**
 * The three people who use this system.
 *
 * This is the ONLY place team members are defined. Changing a name, a colour,
 * or a password here changes it everywhere in the app.
 *
 * NO PASSWORDS LIVE HERE. This repository is public.
 *
 * Each member's password is read from an environment variable at request time
 * — JARVIS_PASSWORD_1 / _2 / _3 — set in Vercel and in .env.local for local
 * development. If the variable is missing, that member simply cannot sign in.
 *
 * To change a password: update the variable in Vercel and redeploy.
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
  /**
   * Name of the environment variable holding this member's password.
   * The password itself is never stored in this repository.
   */
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
    passwordEnvVar: "JARVIS_PASSWORD_3",
  },
];

/** Members without anything secret — safe to send to the browser. */
export type PublicMember = Omit<MemberConfig, "passwordEnvVar" | "email">;

export function toPublicMember(m: MemberConfig): PublicMember {
  const { passwordEnvVar: _e, email: _m, ...rest } = m;
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
