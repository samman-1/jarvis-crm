import { addDays } from "date-fns";
import type {
  ClientRow,
  ParsedActivityRow,
  ParsedClientRow,
} from "@/lib/types";
import type { ClientStatus, InteractionType, Stage } from "@/lib/config/stages";
import { INTERACTION_TYPES } from "@/lib/config/stages";
import { WEEK } from "@/lib/config/schedule";
import { similarity, uid } from "@/lib/utils";
import { toDateKey, startOfWorkWeek } from "@/lib/dates";

/**
 * Reads a pasted message into rows.
 *
 * The input is whatever someone types into WhatsApp at the end of a field day —
 * dashes, numbers, line breaks in odd places, a voice note transcribed badly.
 * The parser is deliberately forgiving and deliberately unconfident: it guesses,
 * then hands the result to a table the member corrects before anything is saved.
 *
 * Nothing here writes. It only proposes.
 */

/* ------------------------------------------------------------------ *
 * Vocabulary
 * ------------------------------------------------------------------ */

const DEAD_WORDS = [
  "dead",
  "do not approach",
  "don't approach",
  "never",
  "finished",
  "blacklist",
  "kicked us out",
  "threw us out",
  "rude",
  "hostile",
  "ميت",
  "منتهي",
  "ممنوع",
  "لا تقترب",
];

const WON_WORDS = ["signed", "won", "closed the deal", "agreed", "وقّع", "تم التوقيع"];
const LOST_WORDS = ["lost", "refused", "declined", "said no", "رفض", "خسارة"];
const HOLD_WORDS = ["on hold", "later", "after ramadan", "postponed", "معلق", "لاحقا", "لاحقاً"];
const PROPOSAL_WORDS = ["proposal", "quote", "quoted", "offer sent", "عرض", "عرض سعر"];
const MEETING_WORDS = ["meeting", "met", "sat with", "presented", "اجتماع", "قابلت"];
const CONTACT_WORDS = ["called", "whatsapp", "messaged", "sent", "اتصلت", "راسلت"];
/** Nobody has actually been in yet — a target rather than a conversation. */
const LEAD_WORDS = [
  "haven't gone",
  "havent gone",
  "not gone",
  "haven't been",
  "not yet",
  "spotted",
  "saw them",
  "to visit",
  "want to visit",
  "لم نذهب",
  "لم أزر",
  "لاحظت",
];

/** Bullets, numbering and stray punctuation at the start of a line. */
const LEADING_NOISE = /^\s*(?:[-–—*•·]|\d+[.)]|\(\d+\))\s*/;

/** Saudi mobile numbers in any of the forms people actually type. */
const PHONE_RE = /(?:\+?966|00966|0)?5\d{1}[\s-]?\d{3}[\s-]?\d{4}/;

const MONEY_RE = /(?:sar|sr|ريال|﷼)?\s*([0-9][0-9,\.]{2,})\s*(?:sar|sr|ريال|k)?/i;

/** "10:30", "10.30am", "at 9" — the time somebody actually went. */
const TIME_RE = /\b(?:at\s*)?([01]?\d|2[0-3])[:.]([0-5]\d)\s*(am|pm)?\b|\b(?:at\s*)(1?\d)\s*(am|pm)\b/i;

function readTime(line: string): string {
  const match = line.match(TIME_RE);
  if (!match) return "";
  let hour = Number(match[1] ?? match[4]);
  const minute = Number(match[2] ?? 0);
  const suffix = (match[3] ?? match[5] ?? "").toLowerCase();
  if (suffix === "pm" && hour < 12) hour += 12;
  if (suffix === "am" && hour === 12) hour = 0;
  if (!Number.isFinite(hour) || hour > 23) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function has(haystack: string, words: string[]): boolean {
  const h = haystack.toLowerCase();
  return words.some((w) => h.includes(w));
}

/* ------------------------------------------------------------------ *
 * Splitting
 * ------------------------------------------------------------------ */

/**
 * One client per block. Blank lines separate blocks; if there are none, every
 * non-empty line is its own client — which is how a quick list gets typed.
 */
function splitBlocks(text: string): string[] {
  const normalised = text.replace(/\r\n/g, "\n").trim();
  if (!normalised) return [];

  const byBlank = normalised
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (byBlank.length > 1) return byBlank;

  return normalised
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Separates the company name from the story.
 *
 * People write "Al-Faisal Trading - walked in, met the manager" or put the name
 * on its own line above the detail. Both are handled; a separator wins over a
 * line break because it is the more deliberate signal.
 */
function splitNameAndBody(block: string): { name: string; body: string } {
  const cleaned = block.replace(LEADING_NOISE, "").trim();

  const separator = cleaned.match(/^(.{2,60}?)\s*(?:[|:]|\s[-–—]\s)\s*([\s\S]+)$/);
  if (separator) {
    return { name: separator[1].trim(), body: separator[2].trim() };
  }

  const lines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    return { name: lines[0].replace(LEADING_NOISE, ""), body: lines.slice(1).join(" ") };
  }

  // A single sentence: take the opening few words as the name and keep the
  // whole thing as the story, since we cannot do better than guess.
  const words = cleaned.split(/\s+/);
  return {
    name: words.slice(0, Math.min(4, words.length)).join(" "),
    body: cleaned,
  };
}

/* ------------------------------------------------------------------ *
 * Clients
 * ------------------------------------------------------------------ */

export function parseClients(
  text: string,
  existing: ClientRow[],
): ParsedClientRow[] {
  return splitBlocks(text).map((block) => {
    const { name, body } = splitNameAndBody(block);
    const whole = `${name} ${body}`;

    let status: ClientStatus = "active";
    let stage: Stage = "contacted";
    let closedReason = "";

    if (has(whole, DEAD_WORDS)) {
      status = "dead";
      // The story is the reason — it is exactly what the other two need to read.
      closedReason = body || name;
    } else if (has(whole, WON_WORDS)) {
      status = "won";
      stage = "won";
    } else if (has(whole, LOST_WORDS)) {
      status = "lost_retryable";
      stage = "lost";
    } else if (has(whole, HOLD_WORDS)) {
      status = "on_hold";
    }

    if (status === "active" || status === "on_hold") {
      // Checked first: "spotted them, haven't gone in yet" also contains
      // words that would otherwise read as contact having happened.
      if (has(whole, LEAD_WORDS)) stage = "lead";
      else if (has(whole, PROPOSAL_WORDS)) stage = "proposal";
      else if (has(whole, MEETING_WORDS)) stage = "meeting";
      else if (has(whole, CONTACT_WORDS)) stage = "contacted";
    }

    const phone = whole.match(PHONE_RE)?.[0]?.trim() ?? "";

    let dealValueSar: number | null = null;
    if (has(whole, PROPOSAL_WORDS)) {
      const money = whole.match(MONEY_RE);
      if (money) {
        const n = Number(money[1].replace(/[,\.]/g, ""));
        // Ignore anything that is obviously a phone number or a year.
        if (Number.isFinite(n) && n >= 500 && n <= 10_000_000) dealValueSar = n;
      }
    }

    // Warn about a company one of us already has — the whole point of the CRM.
    let duplicateOf: ParsedClientRow["duplicateOf"] = null;
    let best = 0;
    for (const c of existing) {
      const score = Math.max(
        similarity(name, c.name),
        c.nameAr ? similarity(name, c.nameAr) : 0,
      );
      if (score > best && score >= 0.72) {
        best = score;
        duplicateOf = { clientId: c.id, ownerId: c.ownerId, status: c.status };
      }
    }

    return {
      id: uid("row"),
      name: name.replace(/[.,;:]$/, "").trim(),
      whatHappened: body,
      city: "",
      contactName: "",
      contactPhone: phone,
      stage,
      status,
      closedReason,
      dealValueSar,
      duplicateOf,
      include: true,
      raw: block,
    };
  });
}

/* ------------------------------------------------------------------ *
 * Activity
 * ------------------------------------------------------------------ */

/**
 * Day names, so "Sunday: went to Areej" lands on Sunday rather than today.
 * Looks backwards — you are reporting what you did, not what you will do.
 */
function dayNameToDate(line: string, reference: Date): string | null {
  const lower = line.toLowerCase();
  const weekStart = startOfWorkWeek(reference);

  for (const day of WEEK) {
    const names = [day.label.toLowerCase(), day.labelAr, day.short.toLowerCase()];
    if (!names.some((n) => lower.includes(n))) continue;

    let date = addDays(weekStart, day.day);
    // A day still ahead of us must mean last week's one.
    if (date > reference) date = addDays(date, -7);
    return toDateKey(date);
  }

  if (lower.includes("today") || lower.includes("اليوم")) return toDateKey(reference);
  if (lower.includes("yesterday") || lower.includes("أمس"))
    return toDateKey(addDays(reference, -1));

  // Explicit dates: 21/7, 21-07, 2026-07-21
  const iso = line.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];

  const dm = line.match(/\b(\d{1,2})[\/\-](\d{1,2})\b/);
  if (dm) {
    const d = new Date(reference);
    d.setMonth(Number(dm[2]) - 1, Number(dm[1]));
    if (d > reference) d.setFullYear(d.getFullYear() - 1);
    return toDateKey(d);
  }

  return null;
}

function guessType(line: string): InteractionType {
  const lower = line.toLowerCase();
  for (const t of INTERACTION_TYPES) {
    if (lower.includes(t.label.toLowerCase()) || lower.includes(t.labelAr)) return t.id;
  }
  if (/\b(visit|walked in|dropped|passed by|زرت|زيارة)\b/.test(lower)) return "visit";
  if (/\b(call|called|phoned|اتصل)\b/.test(lower)) return "call";
  if (/\b(whatsapp|wa|واتس)\b/.test(lower)) return "whatsapp";
  if (/\b(email|mail|بريد)\b/.test(lower)) return "email";
  if (/\b(meeting|met|اجتماع|قابل)\b/.test(lower)) return "meeting";
  if (/\b(proposal|quote|عرض)\b/.test(lower)) return "proposal_sent";
  return "visit";
}

/**
 * Reads "what I did" text into dated activity rows.
 *
 * A line that is only a day name becomes a heading — everything under it
 * inherits that date, which is how people actually write these:
 *
 *   Sunday
 *   - Areej, walked in, owner not there
 *   - Gulf Fresh, met the manager
 *   Tuesday
 *   - Called Barakah about the scoping doc
 */
export function parseActivity(
  text: string,
  clients: ClientRow[],
  reference: Date = new Date(),
): ParsedActivityRow[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const rows: ParsedActivityRow[] = [];
  let currentDate = toDateKey(reference);

  for (const line of lines) {
    const stripped = line.replace(LEADING_NOISE, "").trim();

    // A bare day name (with optional colon) is a heading, not an activity.
    const headingDate = dayNameToDate(stripped, reference);
    if (headingDate && stripped.replace(/[:\-–—\s]/g, "").length <= 12) {
      currentDate = headingDate;
      continue;
    }

    // An inline date applies to this line only.
    const inlineDate = headingDate ?? currentDate;

    // Pull the time out first. Leaving it in wrecked the name match: the head
    // is taken up to the first separator, and a colon is a separator, so
    // "09:20 Barakah Logistics" matched a client called "09".
    const time = readTime(stripped);
    const withoutTime = time ? stripped.replace(TIME_RE, " ").trim() : stripped;

    // Match the client by the opening words, which is where the name sits.
    const head = withoutTime.split(/[,\-–—:|]/)[0].trim();

    /*
     * People do not always put a comma after the company:
     * "Barakah Logistics follow up visit" is one unbroken phrase. Comparing
     * the whole line against a client name scores badly, so try the leading
     * words as well — longest first — and keep the best match found.
     */
    const words = head.split(/\s+/).filter(Boolean);
    const candidates = [head];
    for (let take = Math.min(5, words.length); take >= 1; take--) {
      candidates.push(words.slice(0, take).join(" "));
    }

    let matched = "";
    let best = 0;
    for (const c of clients) {
      for (const candidate of candidates) {
        if (candidate.length < 3) continue;
        const score = Math.max(
          similarity(candidate, c.name),
          c.nameAr ? similarity(candidate, c.nameAr) : 0,
        );
        if (score > best && score >= 0.7) {
          best = score;
          matched = c.id;
        }
      }
    }

    rows.push({
      id: uid("act"),
      clientId: matched,
      clientGuess: head,
      type: guessType(stripped),
      summary: withoutTime || stripped,
      date: inlineDate,
      // Blank when the line carries no time — the table shows an empty field
      // rather than inventing one.
      time,
      include: true,
      raw: line,
    });
  }

  return rows;
}
