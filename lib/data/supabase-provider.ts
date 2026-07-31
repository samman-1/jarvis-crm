import type { DataProvider } from "@/lib/data/provider";
import type {
  Attendance,
  AuditEntry,
  Client,
  ClientDetail,
  ClientFilter,
  ClientRow,
  Contact,
  DateRange,
  DayRoute,
  DuplicateMatch,
  Interaction,
  MemberProfile,
  MemberStats,
  Message,
  NewClientInput,
  NewInteractionInput,
  ParsedActivityRow,
  ParsedClientRow,
  Reminder,
  ScheduleDay,
  Task,
  ThreadSummary,
} from "@/lib/types";
import type { ClientStatus, Stage } from "@/lib/config/stages";

/**
 * The browser side of the shared database.
 *
 * Every method is the same call: post the operation name and its arguments to
 * /api/db, which checks the session and runs it server-side with the
 * service_role key. Nothing about Supabase — not the URL, not a key — is
 * present in the browser bundle.
 *
 * The signatures match MockProvider exactly, which is what lets the app switch
 * between a phone-local system and a shared one without any page changing.
 */
async function call<T>(op: string, args: unknown[] = []): Promise<T> {
  const res = await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, args }),
  });

  const payload = (await res.json()) as { result?: T; error?: string };
  if (!res.ok) {
    if (res.status === 401) {
      // The session expired mid-use; sending them back to sign in beats
      // silently failing every read.
      if (typeof window !== "undefined") {
        window.location.href = window.location.pathname.replace(
          /^\/(en|ar)\/.*/,
          "/$1/login",
        );
      }
      throw new Error("Signed out");
    }
    throw new Error(payload.error ?? "Something went wrong.");
  }
  return payload.result as T;
}

export class SupabaseProvider implements DataProvider {
  readonly mode = "supabase" as const;

  /* --- Clients ----------------------------------------------------- */
  listClients(filter?: ClientFilter) {
    // JSON turns a missing argument into null, which the server would then
    // dereference. Send an empty filter instead of nothing.
    return call<ClientRow[]>("listClients", [filter ?? {}]);
  }
  getClient(id: string) {
    return call<ClientDetail | null>("getClient", [id]);
  }
  createClient(input: NewClientInput, actorId: string) {
    return call<Client>("createClient", [input, actorId]);
  }
  updateClient(id: string, patch: Partial<Client>, actorId: string) {
    return call<Client>("updateClient", [id, patch, actorId]);
  }
  setStage(id: string, stage: Stage, actorId: string) {
    return call<Client>("setStage", [id, stage, actorId]);
  }
  setStatus(
    id: string,
    status: ClientStatus,
    actorId: string,
    opts?: { reason?: string; revisitAfter?: string | null },
  ) {
    return call<Client>("setStatus", [id, status, actorId, opts ?? {}]);
  }
  addCollaborator(clientId: string, memberId: string) {
    return call<Client>("addCollaborator", [clientId, memberId]);
  }
  findPotentialDuplicates(query: { name: string; company?: string; phone?: string }) {
    return call<DuplicateMatch[]>("findPotentialDuplicates", [query]);
  }

  /* --- Contacts ---------------------------------------------------- */
  addContact(clientId: string, contact: Omit<Contact, "id" | "clientId">) {
    return call<Contact>("addContact", [clientId, contact]);
  }
  updateContact(id: string, patch: Partial<Contact>) {
    return call<Contact>("updateContact", [id, patch]);
  }
  deleteContact(id: string) {
    return call<void>("deleteContact", [id]);
  }

  /* --- Interactions ------------------------------------------------ */
  logInteraction(input: NewInteractionInput) {
    return call<Interaction>("logInteraction", [input]);
  }
  listInteractions(opts?: {
    memberId?: string;
    clientId?: string;
    range?: DateRange;
    limit?: number;
  }) {
    return call<Interaction[]>("listInteractions", [opts ?? {}]);
  }

  /* --- Tasks ------------------------------------------------------- */
  listTasks(opts?: { assigneeId?: string; clientId?: string; openOnly?: boolean }) {
    return call<Task[]>("listTasks", [opts ?? {}]);
  }
  createTask(input: Omit<Task, "id" | "createdAt" | "completedAt">) {
    return call<Task>("createTask", [input]);
  }
  toggleTask(id: string, done: boolean) {
    return call<Task>("toggleTask", [id, done]);
  }
  deleteTask(id: string) {
    return call<void>("deleteTask", [id]);
  }

  /* --- Attendance -------------------------------------------------- */
  attendanceFor(memberId: string, range: DateRange) {
    return call<Attendance[]>("attendanceFor", [memberId, range]);
  }
  attendanceToday(memberId: string) {
    return call<Attendance | null>("attendanceToday", [memberId]);
  }
  setHours(
    memberId: string,
    date: string,
    hours: {
      checkIn: string | null;
      checkOut: string | null;
      reason?: string;
      absent?: boolean;
    },
  ) {
    return call<Attendance>("setHours", [memberId, date, hours]);
  }
  setAttendance(memberId: string, date: string, patch: Partial<Attendance>) {
    return call<Attendance>("setAttendance", [memberId, date, patch]);
  }

  /* --- Schedule ---------------------------------------------------- */
  listScheduleDays(range: DateRange) {
    return call<ScheduleDay[]>("listScheduleDays", [range]);
  }
  decideDay(
    date: string,
    memberId: string | null,
    dayType: ScheduleDay["dayType"],
    actorId: string,
    note?: string,
  ) {
    return call<ScheduleDay>("decideDay", [date, memberId, dayType, actorId, note ?? ""]);
  }

  /* --- Stats ------------------------------------------------------- */
  memberStats(memberId: string, range: DateRange) {
    return call<MemberStats>("memberStats", [memberId, range]);
  }
  teamStats(range: DateRange) {
    return call<MemberStats[]>("teamStats", [range]);
  }

  /* --- Reminders --------------------------------------------------- */
  listReminders(memberId: string, opts?: { includeDone?: boolean }) {
    return call<Reminder[]>("listReminders", [memberId, opts ?? {}]);
  }
  createReminder(
    input: Omit<Reminder, "id" | "createdAt" | "done" | "completedAt" | "snoozedUntil">,
  ) {
    return call<Reminder>("createReminder", [input]);
  }
  updateReminder(id: string, patch: Partial<Reminder>) {
    return call<Reminder>("updateReminder", [id, patch]);
  }
  completeReminder(id: string, done: boolean) {
    return call<Reminder>("completeReminder", [id, done]);
  }
  snoozeReminder(id: string, untilDate: string) {
    return call<Reminder>("snoozeReminder", [id, untilDate]);
  }
  deleteReminder(id: string) {
    return call<void>("deleteReminder", [id]);
  }
  refreshAutoReminders(memberId: string) {
    return call<Reminder[]>("refreshAutoReminders", [memberId]);
  }

  /* --- Routes ------------------------------------------------------ */
  listRoutes(memberId: string, opts?: { from?: string }) {
    return call<DayRoute[]>("listRoutes", [memberId, opts ?? {}]);
  }
  getRoute(id: string) {
    return call<DayRoute | null>("getRoute", [id]);
  }
  createRoute(memberId: string, date: string, title: string) {
    return call<DayRoute>("createRoute", [memberId, date, title]);
  }
  updateRoute(id: string, patch: Partial<DayRoute>) {
    return call<DayRoute>("updateRoute", [id, patch]);
  }
  deleteRoute(id: string) {
    return call<void>("deleteRoute", [id]);
  }

  /* --- Chat -------------------------------------------------------- */
  listThreads(memberId: string) {
    return call<ThreadSummary[]>("listThreads", [memberId]);
  }
  listMessages(memberId: string, withId: string | null) {
    return call<Message[]>("listMessages", [memberId, withId]);
  }
  sendMessage(fromId: string, toId: string | null, body: string, clientId?: string | null) {
    return call<Message>("sendMessage", [fromId, toId, body, clientId ?? null]);
  }
  markThreadRead(memberId: string, withId: string | null) {
    return call<void>("markThreadRead", [memberId, withId]);
  }

  /* --- Profile ----------------------------------------------------- */
  getProfile(memberId: string) {
    return call<MemberProfile>("getProfile", [memberId]);
  }
  updateProfile(memberId: string, patch: Partial<MemberProfile>) {
    return call<MemberProfile>("updateProfile", [memberId, patch]);
  }

  /* --- Bulk import ------------------------------------------------- */
  importClients(rows: ParsedClientRow[], ownerId: string) {
    return call<{ created: number; joined: number; skipped: number }>(
      "importClients",
      [rows, ownerId],
    );
  }
  importActivity(rows: ParsedActivityRow[], memberId: string) {
    return call<{ created: number }>("importActivity", [rows, memberId]);
  }

  /* --- Audit + housekeeping ---------------------------------------- */
  listAudit(entityId?: string) {
    return call<AuditEntry[]>("listAudit", [entityId ?? null]);
  }
  async resetToSeed(): Promise<void> {
    throw new Error(
      "Resetting is only available in local mode. The shared database is not wiped from the app.",
    );
  }
  exportAll() {
    return call<string>("exportAll");
  }
  importAll(json: string) {
    return call<void>("importAll", [json]);
  }
}
