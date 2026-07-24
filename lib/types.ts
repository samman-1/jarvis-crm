import type {
  ClientStatus,
  InteractionType,
  Stage,
} from "@/lib/config/stages";

/* ------------------------------------------------------------------ *
 * Core records
 * ------------------------------------------------------------------ */

export interface Contact {
  id: string;
  clientId: string;
  name: string;
  title: string;
  phone: string;
  whatsapp: string;
  email: string;
  isPrimary: boolean;
  notes: string;
  /** How they prefer to be reached. */
  preferredChannel: "whatsapp" | "call" | "email" | "walk_in" | "";
}

export interface Client {
  id: string;
  name: string;
  nameAr: string;
  company: string;
  city: string;
  industry: string;
  website: string;
  sizeGuess: "small" | "mid" | "large" | "";

  stage: Stage;
  status: ClientStatus;

  /** Who owns the relationship. */
  ownerId: string;
  /** Who first brought them in — often, but not always, the owner. */
  broughtById: string;
  /** Anyone else who has also dealt with them. */
  collaboratorIds: string[];

  source: string;
  referredBy: string;

  /** Money. Empty until there are real numbers — by design. */
  dealValueSar: number | null;
  costSar: number | null;

  whatHappened: string;
  whatWeOffered: string;
  objection: string;
  notes: string;
  /** Shown to every member before they go anywhere near this client. */
  teamWarning: string;

  nextAction: string;
  nextActionAt: string | null;

  /** Set when status is `on_hold` or `lost_retryable`. */
  revisitAfter: string | null;

  /** Set when status is `dead`. The reason is mandatory. */
  closedReason: string;
  closedAt: string | null;
  closedById: string;

  firstContactAt: string | null;
  lastContactAt: string | null;

  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface Interaction {
  id: string;
  clientId: string;
  memberId: string;
  type: InteractionType;
  happenedAt: string;
  durationMin: number | null;
  summary: string;
  outcome: string;
  stageBefore: Stage | null;
  stageAfter: Stage | null;
}

export type TaskStatus = "open" | "done" | "dropped";
export type Priority = "low" | "normal" | "high";

export interface Task {
  id: string;
  title: string;
  clientId: string | null;
  assigneeId: string;
  dueAt: string | null;
  status: TaskStatus;
  priority: Priority;
  completedAt: string | null;
  createdAt: string;
}

export type AttendanceStatus =
  | "present"
  | "late"
  | "left_early"
  | "absent"
  | "off"
  | "approved_off";

export interface Attendance {
  id: string;
  memberId: string;
  /** yyyy-MM-dd, Riyadh local. */
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  plannedStart: string;
  plannedEnd: string;
  status: AttendanceStatus;
  /** Why they were late, left early, or were absent. */
  reason: string;
  minutesWorked: number;
}

export type DayDecision = "field" | "meeting" | "on" | "off" | "holiday";

export interface ScheduleDay {
  id: string;
  date: string;
  /** null means the decision applies to the whole team. */
  memberId: string | null;
  dayType: DayDecision;
  decidedById: string;
  note: string;
}

export interface AuditEntry {
  id: string;
  actorId: string;
  entity: "client" | "task" | "attendance" | "schedule";
  entityId: string;
  action: string;
  before: string;
  after: string;
  at: string;
}

/* ------------------------------------------------------------------ *
 * Composed views the UI actually consumes
 * ------------------------------------------------------------------ */

export interface ClientRow extends Client {
  primaryContact: Contact | null;
  lastInteraction: Interaction | null;
  daysSinceContact: number | null;
  interactionCount: number;
  isStale: boolean;
}

export interface ClientDetail extends ClientRow {
  contacts: Contact[];
  interactions: Interaction[];
  tasks: Task[];
  history: AuditEntry[];
}

/* ------------------------------------------------------------------ *
 * Duplicate / collision detection
 * ------------------------------------------------------------------ */

export type MatchReason = "name" | "company" | "phone";

export interface DuplicateMatch {
  client: ClientRow;
  /** 0–1. Above 0.72 we surface it. */
  score: number;
  reason: MatchReason;
  /** How loudly to warn — comes from the matched client's status. */
  level: "info" | "warn" | "block";
}

/* ------------------------------------------------------------------ *
 * Stats, ranges and scoring
 * ------------------------------------------------------------------ */

export type RangeKey = "week" | "month" | "quarter";

export interface DateRange {
  from: string;
  to: string;
  key: RangeKey;
  label: string;
}

export interface EfficiencyBreakdown {
  attendance: number;
  activity: number;
  pipeline: number;
  tasks: number;
}

export interface EfficiencyScore {
  total: number;
  breakdown: EfficiencyBreakdown;
  detail: {
    minutesWorked: number;
    minutesPlanned: number;
    fieldInteractions: number;
    fieldTarget: number;
    stageAdvances: number;
    proposalsSent: number;
    tasksDone: number;
    tasksDueInRange: number;
    tasksLate: number;
  };
}

export interface MemberStats {
  memberId: string;
  range: DateRange;
  clientsTouched: number;
  newClients: number;
  interactions: number;
  visits: number;
  meetings: number;
  calls: number;
  proposalsSent: number;
  stageAdvances: number;
  won: number;
  lost: number;
  dead: number;
  tasksDone: number;
  tasksOpen: number;
  tasksOverdue: number;
  minutesWorked: number;
  minutesPlanned: number;
  daysPresent: number;
  daysLate: number;
  daysAbsent: number;
  efficiency: EfficiencyScore;
  /** One bar per day in the range, for the activity strip. */
  activityByDay: { date: string; count: number }[];
}

/* ------------------------------------------------------------------ *
 * Write payloads
 * ------------------------------------------------------------------ */

export interface NewClientInput {
  name: string;
  nameAr?: string;
  company?: string;
  city?: string;
  industry?: string;
  website?: string;
  stage: Stage;
  status: ClientStatus;
  ownerId: string;
  broughtById: string;
  source?: string;
  referredBy?: string;
  dealValueSar?: number | null;
  whatHappened?: string;
  whatWeOffered?: string;
  objection?: string;
  teamWarning?: string;
  nextAction?: string;
  nextActionAt?: string | null;
  closedReason?: string;
  revisitAfter?: string | null;
  contact?: {
    name: string;
    title?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
  };
}

export interface NewInteractionInput {
  clientId: string;
  memberId: string;
  type: InteractionType;
  happenedAt?: string;
  durationMin?: number | null;
  summary: string;
  outcome?: string;
  /** When set and different from the current stage, the client advances. */
  newStage?: Stage;
}

export interface ClientFilter {
  ownerId?: string;
  stage?: Stage;
  status?: ClientStatus;
  city?: string;
  search?: string;
  staleOnly?: boolean;
  deadOnly?: boolean;
}

export interface SessionUser {
  id: string;
  slot: 1 | 2 | 3;
  name: string;
  role: string;
}
