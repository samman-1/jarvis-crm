/**
 * The Jarvis work week.
 *
 * Sunday, Monday, Tuesday are field days — everyone is out at clients from
 * 09:00 to 14:00. Tuesday also carries the weekly review meeting, where the
 * team decides whether Wednesday and Thursday are working days for each
 * member based on how their field days went. Friday and Saturday are off.
 *
 * Change the rules here and the calendar, attendance scoring and the
 * Wed/Thu decision panel all follow.
 */

export const TIMEZONE = "Asia/Riyadh";

/** JS getDay(): 0 = Sunday … 6 = Saturday. The week starts on Sunday. */
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type DayType =
  | "field"
  | "meeting"
  | "conditional"
  | "off"
  | "holiday";

export interface DayRule {
  day: DayIndex;
  key: string;
  label: string;
  labelAr: string;
  short: string;
  shortAr: string;
  type: DayType;
  /** Only field days are scored for attendance. */
  scored: boolean;
}

export const WEEK: DayRule[] = [
  { day: 0, key: "sun", label: "Sunday",    labelAr: "الأحد",   short: "Sun", shortAr: "أحد", type: "field",       scored: true },
  { day: 1, key: "mon", label: "Monday",    labelAr: "الاثنين", short: "Mon", shortAr: "إثن", type: "field",       scored: true },
  { day: 2, key: "tue", label: "Tuesday",   labelAr: "الثلاثاء", short: "Tue", shortAr: "ثلا", type: "field",       scored: true },
  { day: 3, key: "wed", label: "Wednesday", labelAr: "الأربعاء", short: "Wed", shortAr: "أرب", type: "conditional", scored: false },
  { day: 4, key: "thu", label: "Thursday",  labelAr: "الخميس",  short: "Thu", shortAr: "خمي", type: "conditional", scored: false },
  { day: 5, key: "fri", label: "Friday",    labelAr: "الجمعة",  short: "Fri", shortAr: "جمع", type: "off",         scored: false },
  { day: 6, key: "sat", label: "Saturday",  labelAr: "السبت",   short: "Sat", shortAr: "سبت", type: "off",         scored: false },
];

/** The Tuesday review meeting, where Wed/Thu gets decided. */
export const REVIEW_MEETING = {
  day: 2 as DayIndex,
  start: "14:00",
  end: "15:00",
  label: "Weekly review",
  labelAr: "المراجعة الأسبوعية",
};

export const DEFAULT_START = "09:00";
export const DEFAULT_END = "14:00";

/** Interactions expected per field day before activity scores full marks. */
export const TARGET_INTERACTIONS_PER_FIELD_DAY = 4;

/** Grace before a check-in counts as late / a check-out counts as early. */
export const LATE_GRACE_MINUTES = 10;
export const EARLY_LEAVE_GRACE_MINUTES = 10;

/** Days after which an active client is flagged as going stale. */
export const STALE_AFTER_DAYS = 14;

export function dayRule(day: number): DayRule {
  return WEEK[day] ?? WEEK[0];
}

export function isFieldDay(day: number): boolean {
  return dayRule(day).type === "field";
}

export function isScoredDay(day: number): boolean {
  return dayRule(day).scored;
}

export const FIELD_DAYS: DayIndex[] = WEEK.filter((d) => d.type === "field").map(
  (d) => d.day,
);

export const CONDITIONAL_DAYS: DayIndex[] = WEEK.filter(
  (d) => d.type === "conditional",
).map((d) => d.day);

/** "09:00" → minutes since midnight. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** 545 → "09:05" */
export function fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export const PLANNED_MINUTES_PER_DAY =
  toMinutes(DEFAULT_END) - toMinutes(DEFAULT_START);
