/** Tiny class-name joiner. Avoids pulling in clsx for what is three lines. */
export function cn(
  ...parts: (string | false | null | undefined)[]
): string {
  return parts.filter(Boolean).join(" ");
}

/** Money is always SAR in this system. Empty stays empty — never "0 SAR". */
export function formatSar(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatMinutes(total: number): string {
  if (!total || total <= 0) return "0h";
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return clamp(Math.round((part / whole) * 100), 0, 100);
}

/**
 * Normalises a company name for matching: lowercase, no punctuation, no
 * legal-entity noise, no Arabic diacritics. "Al-Faisal Trading Est." and
 * "alfaisal trading" collapse to the same string.
 */
const NOISE_WORDS = [
  "co",
  "company",
  "est",
  "establishment",
  "llc",
  "ltd",
  "limited",
  "trading",
  "group",
  "holding",
  "corp",
  "corporation",
  "sons",
  "and",
  "the",
  "for",
  "شركة",
  "مؤسسة",
  "مجموعة",
  "التجارية",
  "المحدودة",
];

export function normalizeName(input: string): string {
  const stripped = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = stripped
    .split(" ")
    .filter((w) => w && !NOISE_WORDS.includes(w));

  return (words.length ? words : stripped.split(" ")).join(" ");
}

/** Digits only, last 9 — so +966 5x, 05x and 5x all match each other. */
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits.slice(-9);
}

/** Levenshtein distance, capped early because our strings are short. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

/** 0–1 similarity. 1 is identical. */
export function similarity(a: string, b: string): number {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  // A short name fully contained in a longer one is a strong signal:
  // "al faisal" inside "al faisal trading".
  if (x.includes(y) || y.includes(x)) return 0.92;

  const distance = levenshtein(x, y);
  return 1 - distance / Math.max(x.length, y.length);
}

/** Deterministic PRNG so the demo dataset is identical on every render. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
