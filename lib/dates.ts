import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import type { DateRange, RangeKey } from "@/lib/types";
import { TIMEZONE } from "@/lib/config/schedule";

export { TIMEZONE };

/** The week runs Sunday → Saturday, matching the Saudi working week. */
export function startOfWorkWeek(d: Date = new Date()): Date {
  return startOfDay(addDays(d, -d.getDay()));
}

export function endOfWorkWeek(d: Date = new Date()): Date {
  return endOfDay(addDays(startOfWorkWeek(d), 6));
}

export function toDateKey(d: Date | string): string {
  const date = typeof d === "string" ? parseISO(d) : d;
  return format(date, "yyyy-MM-dd");
}

export function fromDateKey(key: string): Date {
  return parseISO(`${key}T00:00:00`);
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function rangeFor(key: RangeKey, ref: Date = new Date()): DateRange {
  switch (key) {
    case "week":
      return {
        key,
        from: startOfWorkWeek(ref).toISOString(),
        to: endOfWorkWeek(ref).toISOString(),
        label: "This week",
      };
    case "month":
      return {
        key,
        from: startOfMonth(ref).toISOString(),
        to: endOfMonth(ref).toISOString(),
        label: "This month",
      };
    case "quarter":
      return {
        key,
        from: startOfDay(subMonths(ref, 3)).toISOString(),
        to: endOfDay(ref).toISOString(),
        label: "Last 3 months",
      };
  }
}

export function inRange(iso: string | null, range: DateRange): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= new Date(range.from).getTime() && t <= new Date(range.to).getTime();
}

/** Every calendar day in a range — used for the activity bar strips. */
export function daysInRange(range: DateRange): string[] {
  const out: string[] = [];
  let cursor = startOfDay(new Date(range.from));
  const end = new Date(range.to);
  let guard = 0;
  while (cursor <= end && guard++ < 400) {
    out.push(toDateKey(cursor));
    cursor = addDays(cursor, 1);
  }
  return out;
}

export function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  return differenceInCalendarDays(new Date(), new Date(iso));
}

/** "3 days ago", "today", "in 2 days" — short and human. */
export function relativeDays(iso: string | null, locale: "en" | "ar" = "en"): string {
  if (!iso) return locale === "ar" ? "لا يوجد" : "never";
  const d = differenceInCalendarDays(new Date(), new Date(iso));
  if (locale === "ar") {
    if (d === 0) return "اليوم";
    if (d === 1) return "أمس";
    if (d > 0) return `قبل ${d} يوم`;
    if (d === -1) return "غداً";
    return `بعد ${Math.abs(d)} يوم`;
  }
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d > 0) return `${d}d ago`;
  if (d === -1) return "tomorrow";
  return `in ${Math.abs(d)}d`;
}

export function formatDate(iso: string | null, locale: "en" | "ar" = "en"): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TIMEZONE,
  }).format(new Date(iso));
}

export function formatDateTime(iso: string | null, locale: "en" | "ar" = "en"): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIMEZONE,
  }).format(new Date(iso));
}

/**
 * Clock times are handled in the device's local timezone, not forced to
 * Riyadh. The whole team is in Saudi, so local *is* Riyadh — and because
 * hours are typed by hand rather than clocked, forcing a conversion would
 * make "09:00" render back as something else on a machine set elsewhere.
 */
export function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

/** Minutes since local midnight. */
export function minutesOfDay(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/** "09:15" for an <input type="time">, or "" when unset. */
export function toTimeInput(iso: string | null): string {
  if (!iso) return "";
  return formatTime(iso);
}
