import type {
  Attendance,
  AuditEntry,
  Client,
  ClientDetail,
  ClientFilter,
  ClientRow,
  Contact,
  DateRange,
  DuplicateMatch,
  Interaction,
  MemberStats,
  NewClientInput,
  NewInteractionInput,
  ScheduleDay,
  Task,
} from "@/lib/types";
import type { ClientStatus, Stage } from "@/lib/config/stages";

/**
 * The single seam between the interface and wherever the data lives.
 *
 * Phase A  → MockProvider   (seeded demo data + localStorage, this laptop only)
 * Phase B  → SupabaseProvider (Ehan's project, shared by all three members)
 *
 * Nothing in `app/` or `components/` may import a provider directly — they all
 * go through `@/lib/data`. That is the entire reason switching to Supabase is
 * a one-file job rather than a rewrite.
 */
export interface DataProvider {
  readonly mode: "mock" | "supabase";

  /* --- Clients ----------------------------------------------------- */
  listClients(filter?: ClientFilter): Promise<ClientRow[]>;
  getClient(id: string): Promise<ClientDetail | null>;
  createClient(input: NewClientInput, actorId: string): Promise<Client>;
  updateClient(
    id: string,
    patch: Partial<Client>,
    actorId: string,
  ): Promise<Client>;
  setStage(id: string, stage: Stage, actorId: string): Promise<Client>;
  setStatus(
    id: string,
    status: ClientStatus,
    actorId: string,
    opts?: { reason?: string; revisitAfter?: string | null },
  ): Promise<Client>;
  addCollaborator(clientId: string, memberId: string): Promise<Client>;

  /** The collision check that stops two members chasing the same company. */
  findPotentialDuplicates(query: {
    name: string;
    company?: string;
    phone?: string;
  }): Promise<DuplicateMatch[]>;

  /* --- Contacts ---------------------------------------------------- */
  addContact(
    clientId: string,
    contact: Omit<Contact, "id" | "clientId">,
  ): Promise<Contact>;
  updateContact(id: string, patch: Partial<Contact>): Promise<Contact>;
  deleteContact(id: string): Promise<void>;

  /* --- Interactions ------------------------------------------------ */
  logInteraction(input: NewInteractionInput): Promise<Interaction>;
  listInteractions(opts?: {
    memberId?: string;
    clientId?: string;
    range?: DateRange;
    limit?: number;
  }): Promise<Interaction[]>;

  /* --- Tasks ------------------------------------------------------- */
  listTasks(opts?: {
    assigneeId?: string;
    clientId?: string;
    openOnly?: boolean;
  }): Promise<Task[]>;
  createTask(input: Omit<Task, "id" | "createdAt" | "completedAt">): Promise<Task>;
  toggleTask(id: string, done: boolean): Promise<Task>;
  deleteTask(id: string): Promise<void>;

  /* --- Attendance -------------------------------------------------- */
  attendanceFor(memberId: string, range: DateRange): Promise<Attendance[]>;
  attendanceToday(memberId: string): Promise<Attendance | null>;

  /**
   * Write the hours for one day, as typed by the member.
   *
   * Times are plain "HH:MM" strings in Riyadh local time — this is a
   * timesheet you fill in, not a live clock you punch. Passing null for
   * both times clears the day. `absent` marks the day as not worked.
   */
  setHours(
    memberId: string,
    date: string,
    hours: {
      checkIn: string | null;
      checkOut: string | null;
      reason?: string;
      absent?: boolean;
    },
  ): Promise<Attendance>;

  setAttendance(
    memberId: string,
    date: string,
    patch: Partial<Attendance>,
  ): Promise<Attendance>;

  /* --- Schedule ---------------------------------------------------- */
  listScheduleDays(range: DateRange): Promise<ScheduleDay[]>;
  decideDay(
    date: string,
    memberId: string | null,
    dayType: ScheduleDay["dayType"],
    actorId: string,
    note?: string,
  ): Promise<ScheduleDay>;

  /* --- Stats ------------------------------------------------------- */
  memberStats(memberId: string, range: DateRange): Promise<MemberStats>;
  teamStats(range: DateRange): Promise<MemberStats[]>;

  /* --- Audit ------------------------------------------------------- */
  listAudit(entityId?: string): Promise<AuditEntry[]>;

  /* --- Phase A housekeeping ---------------------------------------- */
  /** Wipe local edits and return to the seeded demo dataset. */
  resetToSeed(): Promise<void>;
  /** Everything, as JSON — so the data survives the move to Supabase. */
  exportAll(): Promise<string>;
  importAll(json: string): Promise<void>;
}
