/**
 * Pipeline stages and client statuses.
 *
 * STAGE  = where the client is in the sales process.
 * STATUS = whether anyone should be touching them at all.
 *
 * They are deliberately separate: a client can sit at "Proposal" and still be
 * permanently dead. Rename, reorder or add entries here and the board, kanban,
 * filters, stepper and warnings all follow.
 */

export type Stage =
  | "lead"
  | "contacted"
  | "meeting"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export type ClientStatus =
  | "active"
  | "on_hold"
  | "won"
  | "lost_retryable"
  | "dead";

export interface StageDef {
  id: Stage;
  label: string;
  labelAr: string;
  /** What this stage actually means, shown as help text. */
  hint: string;
  hintAr: string;
  color: string;
  soft: string;
  /** Stages that sit on the kanban board as working columns. */
  inPipeline: boolean;
}

export const STAGES: StageDef[] = [
  {
    id: "lead",
    label: "Lead",
    labelAr: "عميل محتمل",
    hint: "Identified. Nobody has contacted them yet.",
    hintAr: "تم تحديده. لم يتم التواصل معه بعد.",
    color: "var(--faint)",
    soft: "var(--surface-3)",
    inPipeline: true,
  },
  {
    id: "contacted",
    label: "Contacted",
    labelAr: "تم التواصل",
    hint: "First message, call or walk-in happened.",
    hintAr: "تم أول تواصل أو زيارة.",
    color: "var(--info)",
    soft: "var(--info-soft)",
    inPipeline: true,
  },
  {
    id: "meeting",
    label: "Meeting",
    labelAr: "اجتماع",
    hint: "A real meeting or visit took place.",
    hintAr: "تم عقد اجتماع أو زيارة فعلية.",
    color: "var(--info)",
    soft: "var(--info-soft)",
    inPipeline: true,
  },
  {
    id: "proposal",
    label: "Proposal",
    labelAr: "عرض سعر",
    hint: "Offer or quote has been sent.",
    hintAr: "تم إرسال العرض.",
    color: "var(--accent)",
    soft: "var(--accent-soft)",
    inPipeline: true,
  },
  {
    id: "negotiation",
    label: "Negotiation",
    labelAr: "تفاوض",
    hint: "Discussing price, scope or timing.",
    hintAr: "مناقشة السعر والنطاق والتوقيت.",
    color: "var(--warn)",
    soft: "var(--warn-soft)",
    inPipeline: true,
  },
  {
    id: "won",
    label: "Won",
    labelAr: "تم الإغلاق",
    hint: "Signed. They are a client.",
    hintAr: "تم التوقيع. أصبح عميلاً.",
    color: "var(--success)",
    soft: "var(--success-soft)",
    inPipeline: true,
  },
  {
    id: "lost",
    label: "Lost",
    labelAr: "خسارة",
    hint: "It did not happen.",
    hintAr: "لم يتم.",
    color: "var(--critical)",
    soft: "var(--critical-soft)",
    inPipeline: true,
  },
];

export const STAGE_ORDER: Stage[] = STAGES.map((s) => s.id);

export function stageDef(id: Stage): StageDef {
  return STAGES.find((s) => s.id === id) ?? STAGES[0];
}

export function stageIndex(id: Stage): number {
  return STAGE_ORDER.indexOf(id);
}

/** True when moving from `from` to `to` is forward progress in the pipeline. */
export function isAdvance(from: Stage, to: Stage): boolean {
  if (to === "lost") return false;
  return stageIndex(to) > stageIndex(from);
}

export interface StatusDef {
  id: ClientStatus;
  label: string;
  labelAr: string;
  hint: string;
  hintAr: string;
  color: string;
  soft: string;
  /** How hard we warn another member who tries to approach this client. */
  warnLevel: "none" | "info" | "warn" | "block";
}

export const STATUSES: StatusDef[] = [
  {
    id: "active",
    label: "Active",
    labelAr: "نشط",
    hint: "In play. Someone is working it.",
    hintAr: "قيد العمل حالياً.",
    color: "var(--success)",
    soft: "var(--success-soft)",
    warnLevel: "warn",
  },
  {
    id: "on_hold",
    label: "On hold",
    labelAr: "معلّق",
    hint: "Paused, but worth returning to later.",
    hintAr: "متوقف مؤقتاً، يستحق المتابعة لاحقاً.",
    color: "var(--warn)",
    soft: "var(--warn-soft)",
    warnLevel: "warn",
  },
  {
    id: "won",
    label: "Client",
    labelAr: "عميل",
    hint: "Signed and paying.",
    hintAr: "تم التعاقد.",
    color: "var(--success)",
    soft: "var(--success-soft)",
    warnLevel: "warn",
  },
  {
    id: "lost_retryable",
    label: "Lost, can retry",
    labelAr: "خسارة، يمكن المحاولة",
    hint: "Said no this time, but the door is still open.",
    hintAr: "رفض هذه المرة، لكن الباب ما زال مفتوحاً.",
    color: "var(--muted)",
    soft: "var(--surface-3)",
    warnLevel: "info",
  },
  {
    id: "dead",
    label: "Dead, do not approach",
    labelAr: "منتهٍ، ممنوع الاقتراب",
    hint: "Finished permanently. Nobody goes back.",
    hintAr: "منتهٍ نهائياً. لا أحد يعود إليه.",
    color: "var(--critical)",
    soft: "var(--critical-soft)",
    warnLevel: "block",
  },
];

export function statusDef(id: ClientStatus): StatusDef {
  return STATUSES.find((s) => s.id === id) ?? STATUSES[0];
}

/** A dead client is the one case where we physically stop the other members. */
export function isDead(status: ClientStatus): boolean {
  return status === "dead";
}

export type InteractionType =
  | "visit"
  | "call"
  | "whatsapp"
  | "email"
  | "meeting"
  | "proposal_sent"
  | "follow_up";

export interface InteractionTypeDef {
  id: InteractionType;
  label: string;
  labelAr: string;
  icon: string;
  color: string;
  /** Field-day work that counts toward the activity score. */
  countsAsFieldWork: boolean;
}

export const INTERACTION_TYPES: InteractionTypeDef[] = [
  { id: "visit", label: "Visit", labelAr: "زيارة", icon: "📍", color: "var(--accent)", countsAsFieldWork: true },
  { id: "meeting", label: "Meeting", labelAr: "اجتماع", icon: "🤝", color: "var(--accent)", countsAsFieldWork: true },
  { id: "call", label: "Call", labelAr: "اتصال", icon: "📞", color: "var(--info)", countsAsFieldWork: true },
  { id: "whatsapp", label: "WhatsApp", labelAr: "واتساب", icon: "💬", color: "var(--success)", countsAsFieldWork: false },
  { id: "email", label: "Email", labelAr: "بريد", icon: "✉️", color: "var(--info)", countsAsFieldWork: false },
  { id: "proposal_sent", label: "Proposal sent", labelAr: "إرسال عرض", icon: "📄", color: "var(--warn)", countsAsFieldWork: true },
  { id: "follow_up", label: "Follow-up", labelAr: "متابعة", icon: "🔁", color: "var(--muted)", countsAsFieldWork: false },
];

export function interactionTypeDef(id: InteractionType): InteractionTypeDef {
  return INTERACTION_TYPES.find((t) => t.id === id) ?? INTERACTION_TYPES[0];
}

/* ------------------------------------------------------------------ *
 * How we reached them
 *
 * Deliberately not the same axis as stage or status. Stage is how far along
 * they are, status is whether anyone should go near them, and this is what
 * you actually did: a company you emailed and a company whose owner sat with
 * you for half an hour are both "contacted", and that is useless on a board.
 * ------------------------------------------------------------------ */

export type ContactMethod =
  | ""
  | "cold_email"
  | "called"
  | "met"
  | "visited_no_meet"
  | "card_left"
  | "message_sent";

export interface ContactMethodDef {
  id: ContactMethod;
  label: string;
  labelAr: string;
  color: string;
  soft: string;
  /** Shown under the chip so the next step is obvious. */
  hint: string;
  hintAr: string;
}

export const CONTACT_METHODS: ContactMethodDef[] = [
  {
    id: "met",
    label: "Met in person",
    labelAr: "قابلته شخصياً",
    color: "var(--success)",
    soft: "var(--success-soft)",
    hint: "Sat with someone. Follow up on what was said.",
    hintAr: "جلست مع أحدهم. تابع ما اتُّفق عليه.",
  },
  {
    id: "called",
    label: "Called",
    labelAr: "اتصلت",
    color: "var(--info)",
    soft: "var(--info-soft)",
    hint: "Spoke on the phone. Worth going in person.",
    hintAr: "تحدثت هاتفياً. يستحق زيارة شخصية.",
  },
  {
    id: "visited_no_meet",
    label: "Went, nobody there",
    labelAr: "ذهبت ولم أجد أحداً",
    color: "var(--warn)",
    soft: "var(--warn-soft)",
    hint: "Revisit, with an appointment this time.",
    hintAr: "أعد الزيارة، بموعد هذه المرة.",
  },
  {
    id: "card_left",
    label: "Left a card",
    labelAr: "تركت البطاقة",
    color: "var(--warn)",
    soft: "var(--warn-soft)",
    hint: "They have your details. Chase it.",
    hintAr: "لديهم بياناتك. تابعهم.",
  },
  {
    id: "cold_email",
    label: "Cold email",
    labelAr: "بريد بارد",
    color: "var(--muted)",
    soft: "var(--surface-3)",
    hint: "Emailed, no answer yet.",
    hintAr: "أُرسل بريد، بلا رد بعد.",
  },
  {
    id: "message_sent",
    label: "Message sent",
    labelAr: "رسالة مُرسلة",
    color: "var(--muted)",
    soft: "var(--surface-3)",
    hint: "Waiting on a reply.",
    hintAr: "بانتظار الرد.",
  },
];

export function contactMethodDef(id: ContactMethod): ContactMethodDef | null {
  return CONTACT_METHODS.find((c) => c.id === id) ?? null;
}
