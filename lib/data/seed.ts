import { addDays, addMinutes, subDays, subWeeks } from "date-fns";
import type {
  Attendance,
  AuditEntry,
  Client,
  Contact,
  Interaction,
  ScheduleDay,
  Task,
} from "@/lib/types";
import type { ClientStatus, InteractionType, Stage } from "@/lib/config/stages";
import {
  DEFAULT_END,
  DEFAULT_START,
  EARLY_LEAVE_GRACE_MINUTES,
  FIELD_DAYS,
  LATE_GRACE_MINUTES,
  toMinutes,
} from "@/lib/config/schedule";
import { mulberry32 } from "@/lib/utils";
import { toDateKey } from "@/lib/dates";

/**
 * Demo dataset for Phase A.
 *
 * These are invented companies. They exist so the interface can be judged with
 * something that looks like a real pipeline instead of "Client A / Client B".
 * The moment Ehano and Aboodi return their filled-in intake sheets, this file
 * gets replaced with the real thing and nothing else in the app changes.
 *
 * Everything is generated from a fixed PRNG seed, so the demo looks identical
 * on every machine and every reload.
 */

export interface SeedData {
  clients: Client[];
  contacts: Contact[];
  interactions: Interaction[];
  tasks: Task[];
  attendance: Attendance[];
  schedule: ScheduleDay[];
  audit: AuditEntry[];
  /** Marks the shape of the stored payload so upgrades can be detected. */
  version: number;
}

export const SEED_VERSION = 1;

interface ClientSpec {
  id: string;
  name: string;
  nameAr: string;
  city: string;
  industry: string;
  website: string;
  size: Client["sizeGuess"];
  stage: Stage;
  status: ClientStatus;
  ownerId: string;
  broughtById: string;
  collaboratorIds?: string[];
  source: string;
  referredBy?: string;
  offered: string;
  quoted: number | null;
  happened: string;
  objection: string;
  nextAction: string;
  nextInDays: number | null;
  warning?: string;
  closedReason?: string;
  closedById?: string;
  closedDaysAgo?: number;
  revisitInDays?: number;
  firstContactDaysAgo: number;
  lastContactDaysAgo: number;
  contact: {
    name: string;
    title: string;
    phone: string;
    email: string;
    channel: Contact["preferredChannel"];
  };
  second?: { name: string; title: string; phone: string };
}

const SPECS: ClientSpec[] = [
  {
    id: "c01",
    name: "Al-Faisal Trading",
    nameAr: "مؤسسة الفيصل التجارية",
    city: "Riyadh — Olaya",
    industry: "Wholesale distribution",
    website: "alfaisal-trading.example",
    size: "mid",
    stage: "proposal",
    status: "active",
    ownerId: "m1",
    broughtById: "m1",
    source: "Cold walk-in",
    offered: "Invoice processing automation + WhatsApp order intake",
    quoted: 18000,
    happened:
      "Walked in and got past reception on the second try. Ahmed runs operations and immediately understood the invoice problem — they process about 400 supplier invoices a month by hand. Presented the automation, he asked for a written quote. Sent it, waiting.",
    objection: "The owner has not seen the proposal yet — Ahmed cannot sign.",
    nextAction: "Call Ahmed to confirm the owner received the quote",
    nextInDays: 2,
    warning:
      "Khalid the owner is the only decision maker. Do not waste a visit on staff.",
    firstContactDaysAgo: 42,
    lastContactDaysAgo: 6,
    contact: {
      name: "Ahmed Al-Faisal",
      title: "Operations Manager",
      phone: "+966 50 114 2280",
      email: "ahmed@alfaisal-trading.example",
      channel: "whatsapp",
    },
    second: { name: "Khalid Al-Faisal", title: "Owner", phone: "+966 55 220 7714" },
  },
  {
    id: "c02",
    name: "Nakheel Dental Clinic",
    nameAr: "عيادات النخيل لطب الأسنان",
    city: "Riyadh — Al Malaz",
    industry: "Healthcare — dental",
    website: "instagram.com/nakheel.dental",
    size: "small",
    stage: "negotiation",
    status: "active",
    ownerId: "m2",
    broughtById: "m3",
    collaboratorIds: ["m3"],
    source: "Referral",
    referredBy: "Aboodi's cousin is a patient there",
    offered: "Appointment booking + no-show reduction agent on WhatsApp",
    quoted: 12500,
    happened:
      "Aboodi got us the introduction, I took the technical meeting. Dr Reem is sharp — she asked about data privacy for patient records before anything else. Demo of the booking agent went well. She wants the price down to 9,000 and a one-month trial.",
    objection: "Price. Wants a trial period before committing.",
    nextAction: "Send revised scope with a 30-day pilot at 9,500",
    nextInDays: 1,
    firstContactDaysAgo: 55,
    lastContactDaysAgo: 3,
    contact: {
      name: "Dr. Reem Al-Otaibi",
      title: "Clinic Director",
      phone: "+966 53 887 1109",
      email: "reem@nakheel-dental.example",
      channel: "call",
    },
  },
  {
    id: "c03",
    name: "Barakah Logistics",
    nameAr: "بركة للخدمات اللوجستية",
    city: "Dammam",
    industry: "Logistics & freight",
    website: "barakah-log.example",
    size: "large",
    stage: "meeting",
    status: "active",
    ownerId: "m3",
    broughtById: "m3",
    source: "LinkedIn inbound",
    offered: "Driver dispatch assistant + delivery status auto-replies",
    quoted: null,
    happened:
      "They messaged us first after seeing the Mecca portal demo. Long meeting with their ops lead — they have 60 drivers and a dispatcher who does nothing but answer 'where is my shipment' calls all day. Clear pain, clear budget. No quote yet, they want a scoping session.",
    objection: "None yet — still scoping.",
    nextAction: "Prepare scoping document and book the technical session",
    nextInDays: 4,
    warning:
      "This is the biggest opportunity we have. Do not send a number before we scope it properly.",
    firstContactDaysAgo: 21,
    lastContactDaysAgo: 5,
    contact: {
      name: "Majed Al-Harbi",
      title: "Head of Operations",
      phone: "+966 56 442 3390",
      email: "majed@barakah-log.example",
      channel: "email",
    },
  },
  {
    id: "c04",
    name: "Zad Restaurant Group",
    nameAr: "مجموعة زاد للمطاعم",
    city: "Jeddah",
    industry: "Restaurants — 6 branches",
    website: "",
    size: "mid",
    stage: "meeting",
    status: "dead",
    ownerId: "m3",
    broughtById: "m3",
    source: "Cold walk-in",
    offered: "Customer service chatbot for orders and complaints",
    quoted: null,
    happened:
      "Walked in twice. The first time we were told to come back. The second time the owner shouted at us in front of customers and said we were wasting his time selling 'robot nonsense'. We left.",
    objection: "Hostile to the entire concept.",
    nextAction: "Nothing — dead",
    nextInDays: null,
    closedReason:
      "Owner was hostile and told us not to come back to any branch. He shouted at us in front of customers. Approaching them again would damage our reputation in that area.",
    closedById: "m3",
    closedDaysAgo: 68,
    warning:
      "DO NOT APPROACH any Zad branch. The owner knows our faces and reacted badly in public.",
    firstContactDaysAgo: 82,
    lastContactDaysAgo: 68,
    contact: {
      name: "Faisal Zad",
      title: "Owner",
      phone: "+966 50 330 8812",
      email: "",
      channel: "walk_in",
    },
  },
  {
    id: "c05",
    name: "Tamimi Auto Parts",
    nameAr: "التميمي لقطع الغيار",
    city: "Riyadh — Al Sulaymaniyah",
    industry: "Retail — automotive",
    website: "tamimi-parts.example",
    size: "mid",
    stage: "won",
    status: "won",
    ownerId: "m2",
    broughtById: "m1",
    collaboratorIds: ["m1"],
    source: "Referral",
    referredBy: "Ehano's contact from the chamber of commerce event",
    offered: "Parts lookup agent over WhatsApp + stock sync",
    quoted: 22000,
    happened:
      "Ehano opened the door through the chamber event, I ran the build conversation. Signed a 3-month pilot at 22,000. They went live six weeks ago and their WhatsApp enquiry handling went from 40 minutes to under 2. First real reference we have.",
    objection: "Resolved — signed.",
    nextAction: "Monthly check-in call and ask for a written testimonial",
    nextInDays: 9,
    warning:
      "Our only live reference. Anything we ask of them should go through Sammoni first.",
    firstContactDaysAgo: 96,
    lastContactDaysAgo: 11,
    contact: {
      name: "Yousef Al-Tamimi",
      title: "General Manager",
      phone: "+966 55 771 2043",
      email: "yousef@tamimi-parts.example",
      channel: "whatsapp",
    },
  },
  {
    id: "c06",
    name: "Rawabi Contracting",
    nameAr: "روابي للمقاولات",
    city: "Riyadh — Exit 10",
    industry: "Construction",
    website: "",
    size: "large",
    stage: "contacted",
    status: "active",
    ownerId: "m1",
    broughtById: "m1",
    source: "Cold walk-in",
    offered: "Not yet presented — document handling and site reporting",
    quoted: null,
    happened:
      "Reception took our card and said the procurement manager would call. Followed up on WhatsApp twice, got one reply saying 'after the current project'. Still worth chasing, they are big.",
    objection: "Busy with a live project, not paying attention to us.",
    nextAction: "Try again in person, ask for the procurement manager by name",
    nextInDays: 7,
    firstContactDaysAgo: 34,
    lastContactDaysAgo: 16,
    contact: {
      name: "Reception",
      title: "Front desk",
      phone: "+966 11 462 9900",
      email: "",
      channel: "walk_in",
    },
  },
  {
    id: "c07",
    name: "Hala Beauty Center",
    nameAr: "مركز هالة للتجميل",
    city: "Riyadh — Al Nakheel",
    industry: "Beauty & wellness",
    website: "instagram.com/hala.beauty",
    size: "small",
    stage: "proposal",
    status: "on_hold",
    ownerId: "m3",
    broughtById: "m3",
    source: "Instagram DM",
    offered: "Booking agent + automated follow-up for repeat appointments",
    quoted: 7500,
    happened:
      "Good first meeting, the manager loved the idea and asked for a quote the same day. Sent 7,500. Then she came back and said the owner has frozen all new spending until the new branch opens.",
    objection: "Budget frozen until the second branch opens.",
    nextAction: "Check back once the new branch is open",
    nextInDays: null,
    revisitInDays: 38,
    firstContactDaysAgo: 47,
    lastContactDaysAgo: 24,
    contact: {
      name: "Hala Al-Zahrani",
      title: "Owner",
      phone: "+966 54 118 6677",
      email: "hala@halabeauty.example",
      channel: "whatsapp",
    },
  },
  {
    id: "c08",
    name: "Saad Medical Supplies",
    nameAr: "سعد للمستلزمات الطبية",
    city: "Al Khobar",
    industry: "Medical distribution",
    website: "saadmed.example",
    size: "mid",
    stage: "lost",
    status: "lost_retryable",
    ownerId: "m1",
    broughtById: "m1",
    source: "Cold call",
    offered: "Order intake automation for hospital purchase orders",
    quoted: 15000,
    happened:
      "Two good meetings and a proposal. They went with an existing vendor who already handles their ERP and offered to bolt something on. The purchasing manager was apologetic and said to come back when that contract ends.",
    objection: "Incumbent vendor bundled it into an existing contract.",
    nextAction: "Diarise a check-in when their vendor contract is up",
    nextInDays: null,
    revisitInDays: 120,
    warning:
      "Their current vendor is a competitor of ours. Do not badmouth them — the purchasing manager is friendly with that team.",
    firstContactDaysAgo: 74,
    lastContactDaysAgo: 31,
    contact: {
      name: "Abdulrahman Saad",
      title: "Purchasing Manager",
      phone: "+966 50 664 2218",
      email: "a.saad@saadmed.example",
      channel: "email",
    },
  },
  {
    id: "c09",
    name: "Noor Academy",
    nameAr: "أكاديمية نور",
    city: "Riyadh — Al Yasmin",
    industry: "Private education",
    website: "nooracademy.example",
    size: "mid",
    stage: "proposal",
    status: "active",
    ownerId: "m2",
    broughtById: "m2",
    source: "Referral",
    referredBy: "Tamimi Auto Parts introduced us",
    offered: "Parent communication agent + admissions enquiry handling",
    quoted: 14000,
    happened:
      "Warm introduction from Yousef at Tamimi. The admissions team drowns in the same twelve questions every August. Demoed the enquiry agent using their own FAQ page — that landed well. Proposal sent last week.",
    objection: "Wants to see it working before the admissions season starts.",
    nextAction: "Follow up on the proposal and offer a two-week pilot",
    nextInDays: 3,
    firstContactDaysAgo: 28,
    lastContactDaysAgo: 8,
    contact: {
      name: "Sara Al-Dossary",
      title: "Head of Admissions",
      phone: "+966 55 902 4471",
      email: "sara@nooracademy.example",
      channel: "email",
    },
  },
  {
    id: "c10",
    name: "Gulf Fresh Markets",
    nameAr: "أسواق الخليج الطازجة",
    city: "Riyadh — Al Suwaidi",
    industry: "Grocery retail — 4 stores",
    website: "",
    size: "mid",
    stage: "lead",
    status: "active",
    ownerId: "m3",
    broughtById: "m3",
    source: "Spotted while driving",
    offered: "Nothing yet",
    quoted: null,
    happened: "Noted as a target. Nobody has walked in yet.",
    objection: "",
    nextAction: "First walk-in on the next Suwaidi field day",
    nextInDays: 5,
    firstContactDaysAgo: 0,
    lastContactDaysAgo: -1,
    contact: {
      name: "",
      title: "",
      phone: "",
      email: "",
      channel: "",
    },
  },
  {
    id: "c11",
    name: "Areej Perfumes",
    nameAr: "أريج للعطور",
    city: "Riyadh — Al Rawdah",
    industry: "Retail — fragrance",
    website: "instagram.com/areej.perfumes",
    size: "small",
    stage: "contacted",
    status: "active",
    ownerId: "m2",
    broughtById: "m2",
    source: "Cold walk-in",
    offered: "Instagram DM auto-reply and order taking",
    quoted: null,
    happened:
      "Short conversation with the shop manager. She said the owner handles the Instagram account herself and gets 200 DMs a day she cannot answer. That is exactly our product. Waiting for the owner to be in store.",
    objection: "Owner is rarely in the shop.",
    nextAction: "Ask when the owner is next in and go then",
    nextInDays: 2,
    firstContactDaysAgo: 12,
    lastContactDaysAgo: 12,
    contact: {
      name: "Munira",
      title: "Shop Manager",
      phone: "+966 59 335 1180",
      email: "",
      channel: "walk_in",
    },
  },
  {
    id: "c12",
    name: "Mustaqbal Real Estate",
    nameAr: "المستقبل العقارية",
    city: "Riyadh — King Fahd Road",
    industry: "Real estate brokerage",
    website: "mustaqbal-re.example",
    size: "mid",
    stage: "meeting",
    status: "active",
    ownerId: "m1",
    broughtById: "m2",
    collaboratorIds: ["m2"],
    source: "Inbound — website form",
    offered: "Lead qualification agent for property enquiries",
    quoted: null,
    happened:
      "They filled in the contact form on our site. First meeting was mostly them explaining how many junk enquiries they get. Around 70% of their leads never answer the phone. Good fit. They want to see a demo with their own listings.",
    objection: "Sceptical that an agent can qualify better than their juniors.",
    nextAction: "Build a demo using three of their live listings",
    nextInDays: 6,
    firstContactDaysAgo: 19,
    lastContactDaysAgo: 4,
    contact: {
      name: "Turki Al-Mutairi",
      title: "Sales Director",
      phone: "+966 50 227 9963",
      email: "turki@mustaqbal-re.example",
      channel: "call",
    },
  },
  {
    id: "c13",
    name: "Sahara Tours",
    nameAr: "صحارى للسياحة",
    city: "Riyadh — Al Murabba",
    industry: "Travel agency",
    website: "",
    size: "small",
    stage: "contacted",
    status: "dead",
    ownerId: "m3",
    broughtById: "m3",
    source: "Cold walk-in",
    offered: "Booking enquiry automation",
    quoted: 6000,
    happened:
      "The owner laughed at the price and said he would 'pay a boy 1,500 a month to do the same thing'. Made it clear he sees no value in software at all. Not a budget problem — a belief problem.",
    objection: "Does not believe software should cost more than a salary.",
    nextAction: "Nothing — dead",
    nextInDays: null,
    closedReason:
      "Owner fundamentally does not value software and compared our price to a junior salary. This is not a timing or budget issue, it is a belief issue. Any future visit is a wasted morning.",
    closedById: "m3",
    closedDaysAgo: 40,
    firstContactDaysAgo: 51,
    lastContactDaysAgo: 40,
    contact: {
      name: "Abu Nasser",
      title: "Owner",
      phone: "+966 50 771 3345",
      email: "",
      channel: "walk_in",
    },
  },
  {
    id: "c14",
    name: "Ibn Sina Pharmacy Chain",
    nameAr: "صيدليات ابن سينا",
    city: "Riyadh — multiple",
    industry: "Pharmacy — 11 branches",
    website: "ibnsina-rx.example",
    size: "large",
    stage: "negotiation",
    status: "active",
    ownerId: "m1",
    broughtById: "m1",
    collaboratorIds: ["m2"],
    source: "Referral",
    referredBy: "Dr. Reem at Nakheel Dental",
    offered: "Prescription refill reminders + branch stock enquiry agent",
    quoted: 31000,
    happened:
      "Dr. Reem passed our name to their operations director. Two meetings, both serious. They want it across all 11 branches but are pushing for staged payment and a penalty clause if uptime drops. Sammoni is on the technical side of the conversation now.",
    objection: "Wants staged payments and an SLA with penalties.",
    nextAction: "Send revised contract with staged payments and a 99% SLA",
    nextInDays: 2,
    warning:
      "They came through Dr. Reem at Nakheel Dental. Anything that goes wrong here hurts that deal too.",
    firstContactDaysAgo: 38,
    lastContactDaysAgo: 2,
    contact: {
      name: "Nawaf Al-Ghamdi",
      title: "Operations Director",
      phone: "+966 55 448 2201",
      email: "nawaf@ibnsina-rx.example",
      channel: "call",
    },
  },
];

/* ------------------------------------------------------------------ *
 * Interaction chains — what plausibly happened for each stage
 * ------------------------------------------------------------------ */

const CHAIN: Record<Stage, { type: InteractionType; summary: string }[]> = {
  lead: [],
  contacted: [
    { type: "visit", summary: "First walk-in, left our card at reception" },
    { type: "whatsapp", summary: "Sent company profile, no reply yet" },
  ],
  meeting: [
    { type: "visit", summary: "First walk-in, left our card at reception" },
    { type: "whatsapp", summary: "Sent company profile" },
    { type: "call", summary: "Got through to the decision maker, booked a meeting" },
    { type: "meeting", summary: "Full meeting — presented what we do and how it applies to them" },
  ],
  proposal: [
    { type: "visit", summary: "First walk-in" },
    { type: "call", summary: "Booked the meeting" },
    { type: "meeting", summary: "Presented the solution, they asked for a written quote" },
    { type: "proposal_sent", summary: "Sent the proposal" },
    { type: "follow_up", summary: "Follow-up message on the proposal" },
  ],
  negotiation: [
    { type: "visit", summary: "First walk-in" },
    { type: "meeting", summary: "Discovery meeting" },
    { type: "proposal_sent", summary: "Sent the proposal" },
    { type: "call", summary: "They came back with questions on price" },
    { type: "meeting", summary: "Second meeting — went through scope and pricing line by line" },
    { type: "follow_up", summary: "Agreed to send a revised version" },
  ],
  won: [
    { type: "visit", summary: "Introduction visit" },
    { type: "meeting", summary: "Discovery meeting" },
    { type: "proposal_sent", summary: "Sent the proposal" },
    { type: "meeting", summary: "Negotiated scope and timeline" },
    { type: "call", summary: "Verbal agreement" },
    { type: "meeting", summary: "Contract signed" },
    { type: "follow_up", summary: "Post-launch check-in" },
  ],
  lost: [
    { type: "visit", summary: "First walk-in" },
    { type: "meeting", summary: "Discovery meeting" },
    { type: "proposal_sent", summary: "Sent the proposal" },
    { type: "call", summary: "They told us they are going with another vendor" },
  ],
};

/* ------------------------------------------------------------------ *
 * Attendance behaviour — gives each member a distinguishable pattern
 * ------------------------------------------------------------------ */

const BEHAVIOUR: Record<
  string,
  { lateChance: number; earlyChance: number; absentChance: number; drift: number }
> = {
  // Ehano is reliably early and stays the full window.
  m1: { lateChance: 0.08, earlyChance: 0.1, absentChance: 0.03, drift: 6 },
  // Sammoni starts on time but often runs over into the afternoon.
  m2: { lateChance: 0.18, earlyChance: 0.12, absentChance: 0.04, drift: 14 },
  // Aboodi is the one the calendar exists for.
  m3: { lateChance: 0.42, earlyChance: 0.34, absentChance: 0.08, drift: 22 },
};

const TASK_TITLES: { title: string; clientId: string | null; memberId: string }[] = [
  { title: "Call Ahmed about the owner reviewing the quote", clientId: "c01", memberId: "m1" },
  { title: "Send revised pilot scope to Dr. Reem", clientId: "c02", memberId: "m2" },
  { title: "Write the Barakah scoping document", clientId: "c03", memberId: "m3" },
  { title: "Ask Yousef for a written testimonial", clientId: "c05", memberId: "m2" },
  { title: "Second walk-in at Rawabi — ask for procurement by name", clientId: "c06", memberId: "m1" },
  { title: "Build the Mustaqbal demo with their live listings", clientId: "c12", memberId: "m1" },
  { title: "Send Ibn Sina the staged-payment contract", clientId: "c14", memberId: "m1" },
  { title: "Follow up Noor Academy proposal", clientId: "c09", memberId: "m2" },
  { title: "Find out when Areej's owner is in the shop", clientId: "c11", memberId: "m2" },
  { title: "First walk-in at Gulf Fresh", clientId: "c10", memberId: "m3" },
  { title: "Update the company profile PDF with the Tamimi case study", clientId: null, memberId: "m2" },
  { title: "Plan next week's Suwaidi route", clientId: null, memberId: "m3" },
  { title: "Chamber of commerce event — confirm attendance", clientId: null, memberId: "m1" },
];

/* ------------------------------------------------------------------ */

export function buildSeed(now: Date = new Date()): SeedData {
  const rand = mulberry32(20260724);
  const clients: Client[] = [];
  const contacts: Contact[] = [];
  const interactions: Interaction[] = [];
  const audit: AuditEntry[] = [];

  for (const s of SPECS) {
    const firstAt =
      s.firstContactDaysAgo > 0
        ? subDays(now, s.firstContactDaysAgo).toISOString()
        : null;
    const lastAt =
      s.lastContactDaysAgo >= 0
        ? subDays(now, s.lastContactDaysAgo).toISOString()
        : null;

    clients.push({
      id: s.id,
      name: s.name,
      nameAr: s.nameAr,
      company: s.name,
      city: s.city,
      industry: s.industry,
      website: s.website,
      sizeGuess: s.size,
      stage: s.stage,
      status: s.status,
      ownerId: s.ownerId,
      broughtById: s.broughtById,
      collaboratorIds: s.collaboratorIds ?? [],
      source: s.source,
      referredBy: s.referredBy ?? "",
      dealValueSar: s.quoted,
      costSar: null,
      whatHappened: s.happened,
      whatWeOffered: s.offered,
      objection: s.objection,
      notes: "",
      teamWarning: s.warning ?? "",
      nextAction: s.nextAction,
      nextActionAt:
        s.nextInDays === null ? null : addDays(now, s.nextInDays).toISOString(),
      revisitAfter:
        s.revisitInDays === undefined
          ? null
          : addDays(now, s.revisitInDays).toISOString(),
      closedReason: s.closedReason ?? "",
      closedAt:
        s.closedDaysAgo === undefined
          ? null
          : subDays(now, s.closedDaysAgo).toISOString(),
      closedById: s.closedById ?? "",
      firstContactAt: firstAt,
      lastContactAt: lastAt,
      createdById: s.broughtById,
      createdAt: firstAt ?? now.toISOString(),
      updatedAt: lastAt ?? now.toISOString(),
    });

    if (s.contact.name) {
      contacts.push({
        id: `${s.id}_ct1`,
        clientId: s.id,
        name: s.contact.name,
        title: s.contact.title,
        phone: s.contact.phone,
        whatsapp: s.contact.channel === "whatsapp" ? s.contact.phone : "",
        email: s.contact.email,
        isPrimary: true,
        notes: "",
        preferredChannel: s.contact.channel,
      });
    }
    if (s.second) {
      contacts.push({
        id: `${s.id}_ct2`,
        clientId: s.id,
        name: s.second.name,
        title: s.second.title,
        phone: s.second.phone,
        whatsapp: "",
        email: "",
        isPrimary: false,
        notes: "Decision maker",
        preferredChannel: "",
      });
    }

    /* Interaction chain, spread evenly between first and last contact. */
    const chain = CHAIN[s.stage];
    if (chain.length && firstAt && lastAt) {
      const span = s.firstContactDaysAgo - Math.max(s.lastContactDaysAgo, 0);
      const step = chain.length > 1 ? span / (chain.length - 1) : 0;
      chain.forEach((link, i) => {
        const daysBack = Math.round(s.firstContactDaysAgo - step * i);
        const at = subDays(now, Math.max(daysBack, 0));
        at.setHours(9 + Math.floor(rand() * 5), Math.floor(rand() * 60), 0, 0);
        const isLast = i === chain.length - 1;
        interactions.push({
          id: `${s.id}_i${i}`,
          clientId: s.id,
          memberId:
            s.collaboratorIds?.length && i % 3 === 1
              ? s.collaboratorIds[0]
              : s.ownerId,
          type: link.type,
          happenedAt: at.toISOString(),
          durationMin:
            link.type === "meeting"
              ? 30 + Math.floor(rand() * 60)
              : link.type === "visit"
                ? 10 + Math.floor(rand() * 25)
                : link.type === "call"
                  ? 5 + Math.floor(rand() * 20)
                  : null,
          summary: link.summary,
          outcome: isLast ? s.objection : "",
          stageBefore: null,
          stageAfter: null,
        });
      });

      audit.push({
        id: `${s.id}_a1`,
        actorId: s.ownerId,
        entity: "client",
        entityId: s.id,
        action: "stage_changed",
        before: "lead",
        after: s.stage,
        at: lastAt,
      });
    }

    if (s.status === "dead" && s.closedDaysAgo !== undefined) {
      audit.push({
        id: `${s.id}_a2`,
        actorId: s.closedById ?? s.ownerId,
        entity: "client",
        entityId: s.id,
        action: "marked_dead",
        before: "active",
        after: "dead",
        at: subDays(now, s.closedDaysAgo).toISOString(),
      });
    }
  }

  /* --- This week's activity ------------------------------------------
   * The historical chains above spread across three months, which leaves the
   * current week looking empty — and "this week" is the view everyone opens
   * first. So each member gets a realistic set of field-day contacts on the
   * days of this week that have already happened.
   * ------------------------------------------------------------------- */
  const thisWeekSunday = addDays(now, -now.getDay());
  const WEEK_ACTIVITY: {
    memberId: string;
    perDay: number;
    clientIds: string[];
    lines: { type: InteractionType; summary: string }[];
  }[] = [
    {
      memberId: "m1",
      perDay: 4,
      clientIds: ["c01", "c06", "c08", "c12", "c14"],
      lines: [
        { type: "visit", summary: "Dropped in, spoke to the manager on the floor" },
        { type: "call", summary: "Called to confirm the meeting" },
        { type: "meeting", summary: "Sat down and went through the proposal" },
        { type: "follow_up", summary: "Sent a follow-up message after the visit" },
      ],
    },
    {
      memberId: "m2",
      perDay: 3,
      clientIds: ["c02", "c05", "c09", "c11", "c14"],
      lines: [
        { type: "meeting", summary: "Technical walkthrough of the integration" },
        { type: "whatsapp", summary: "Answered their questions on WhatsApp" },
        { type: "call", summary: "Quick call about pricing" },
        { type: "visit", summary: "Site visit to see how they work day to day" },
      ],
    },
    {
      memberId: "m3",
      perDay: 2,
      clientIds: ["c03", "c07", "c10"],
      lines: [
        { type: "visit", summary: "First walk-in on the Suwaidi route" },
        { type: "whatsapp", summary: "Sent the company profile" },
        { type: "call", summary: "Tried the owner, no answer" },
      ],
    },
  ];

  let weekSeq = 0;
  for (const plan of WEEK_ACTIVITY) {
    for (const day of FIELD_DAYS) {
      const date = addDays(thisWeekSunday, day);
      if (date > now) continue;

      for (let n = 0; n < plan.perDay; n++) {
        const clientId = plan.clientIds[(weekSeq + n) % plan.clientIds.length];
        const line = plan.lines[(weekSeq + n) % plan.lines.length];
        const at = new Date(date);
        at.setHours(9 + n, Math.floor(rand() * 55), 0, 0);
        if (at > now) continue;

        interactions.push({
          id: `wk_${plan.memberId}_${day}_${n}`,
          clientId,
          memberId: plan.memberId,
          type: line.type,
          happenedAt: at.toISOString(),
          durationMin:
            line.type === "meeting"
              ? 35 + Math.floor(rand() * 40)
              : line.type === "visit"
                ? 12 + Math.floor(rand() * 20)
                : 6 + Math.floor(rand() * 15),
          summary: line.summary,
          outcome: "",
          stageBefore: null,
          stageAfter: null,
        });

        const client = clients.find((c) => c.id === clientId);
        if (client && (!client.lastContactAt || client.lastContactAt < at.toISOString())) {
          client.lastContactAt = at.toISOString();
        }
      }
      weekSeq++;
    }
  }

  // Ehano moved one deal forward this week — gives the pipeline component
  // of the efficiency score something real to measure.
  const advanceAt = addDays(thisWeekSunday, 1);
  advanceAt.setHours(11, 20, 0, 0);
  if (advanceAt <= now) {
    interactions.push({
      id: "wk_advance_1",
      clientId: "c14",
      memberId: "m1",
      type: "proposal_sent",
      happenedAt: advanceAt.toISOString(),
      durationMin: null,
      summary: "Sent the revised contract with staged payments",
      outcome: "They are reviewing with their legal team",
      stageBefore: "proposal",
      stageAfter: "negotiation",
    });
  }

  /* --- Attendance: the last 12 weeks of field days ------------------- */
  const attendance: Attendance[] = [];
  const plannedStartMin = toMinutes(DEFAULT_START);
  const plannedEndMin = toMinutes(DEFAULT_END);

  for (let w = 11; w >= 0; w--) {
    const weekRef = subWeeks(now, w);
    const sunday = addDays(weekRef, -weekRef.getDay());

    for (const memberId of ["m1", "m2", "m3"]) {
      const b = BEHAVIOUR[memberId];
      for (const day of FIELD_DAYS) {
        const date = addDays(sunday, day);
        if (date > now) continue;

        const dateKey = toDateKey(date);
        const roll = rand();

        if (roll < b.absentChance) {
          attendance.push({
            id: `${memberId}_${dateKey}`,
            memberId,
            date: dateKey,
            checkInAt: null,
            checkOutAt: null,
            plannedStart: DEFAULT_START,
            plannedEnd: DEFAULT_END,
            status: "absent",
            reason: rand() > 0.5 ? "Family commitment" : "Sick",
            minutesWorked: 0,
          });
          continue;
        }

        const late = rand() < b.lateChance;
        const early = rand() < b.earlyChance;

        const startOffset = late
          ? LATE_GRACE_MINUTES + 5 + Math.floor(rand() * b.drift * 2)
          : Math.floor(rand() * LATE_GRACE_MINUTES) - 5;
        const endOffset = early
          ? -(EARLY_LEAVE_GRACE_MINUTES + 5 + Math.floor(rand() * b.drift * 2))
          : Math.floor(rand() * b.drift);

        const checkIn = new Date(date);
        checkIn.setHours(0, 0, 0, 0);
        const inAt = addMinutes(checkIn, plannedStartMin + startOffset);
        const outAt = addMinutes(checkIn, plannedEndMin + endOffset);

        const covered =
          Math.min(outAt.getTime(), addMinutes(checkIn, plannedEndMin).getTime()) -
          Math.max(inAt.getTime(), addMinutes(checkIn, plannedStartMin).getTime());
        const minutesWorked = Math.max(0, Math.round(covered / 60000));

        attendance.push({
          id: `${memberId}_${dateKey}`,
          memberId,
          date: dateKey,
          checkInAt: inAt.toISOString(),
          checkOutAt: outAt.toISOString(),
          plannedStart: DEFAULT_START,
          plannedEnd: DEFAULT_END,
          status: late ? "late" : early ? "left_early" : "present",
          reason: late
            ? "Traffic on the way from the first client"
            : early
              ? "Client cancelled the last appointment"
              : "",
          minutesWorked,
        });
      }
    }
  }

  /* --- Tasks --------------------------------------------------------- */
  const tasks: Task[] = TASK_TITLES.map((t, i) => {
    const overdue = i % 5 === 3;
    const done = i % 3 === 0;
    const dueAt = overdue
      ? subDays(now, 2 + (i % 4)).toISOString()
      : addDays(now, 1 + (i % 7)).toISOString();
    return {
      id: `t${String(i + 1).padStart(2, "0")}`,
      title: t.title,
      clientId: t.clientId,
      assigneeId: t.memberId,
      dueAt,
      status: done ? "done" : "open",
      priority: i % 4 === 0 ? "high" : i % 3 === 0 ? "low" : "normal",
      completedAt: done ? subDays(now, 1).toISOString() : null,
      createdAt: subDays(now, 7 + i).toISOString(),
    };
  });

  /* --- Schedule: last Tuesday's Wed/Thu decision --------------------- */
  const schedule: ScheduleDay[] = [];
  const lastSunday = addDays(now, -now.getDay());
  const wed = addDays(lastSunday, 3);
  const thu = addDays(lastSunday, 4);
  schedule.push(
    {
      id: "sd1",
      date: toDateKey(wed),
      memberId: "m3",
      dayType: "on",
      decidedById: "m1",
      note: "Behind on field activity — Wednesday is a working day this week.",
    },
    {
      id: "sd2",
      date: toDateKey(wed),
      memberId: "m1",
      dayType: "off",
      decidedById: "m1",
      note: "Targets met by Tuesday.",
    },
    {
      id: "sd3",
      date: toDateKey(thu),
      memberId: "m3",
      dayType: "on",
      decidedById: "m1",
      note: "Same as Wednesday.",
    },
  );

  return {
    clients,
    contacts,
    interactions,
    tasks,
    attendance,
    schedule,
    audit,
    version: SEED_VERSION,
  };
}
