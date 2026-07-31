import { addDays, differenceInCalendarDays } from "date-fns";
import type { DataProvider } from "@/lib/data/provider";
import { SEED_VERSION, buildSeed, type SeedData } from "@/lib/data/seed";
import type {
  Attendance,
  MemberProfile,
  Message,
  DayRoute,
  ParsedActivityRow,
  ParsedClientRow,
  ParsedTaskRow,
  Reminder,
  ThreadSummary,
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
import {
  type ClientStatus,
  type Stage,
  isAdvance,
  statusDef,
} from "@/lib/config/stages";
import {
  DEFAULT_END,
  DEFAULT_START,
  EARLY_LEAVE_GRACE_MINUTES,
  LATE_GRACE_MINUTES,
  STALE_AFTER_DAYS,
  isScoredDay,
  toMinutes,
} from "@/lib/config/schedule";
import { MEMBERS } from "@/lib/config/members";
import { computeEfficiency } from "@/lib/efficiency";
import {
  daysInRange,
  fromDateKey,
  inRange,
  isoNow,
  minutesOfDay,
  toDateKey,
} from "@/lib/dates";
import { normalizePhone, similarity, uid } from "@/lib/utils";

const STORAGE_KEY = "jarvis-crm:data:v2";
/** Profiles are stored apart so resetting the dataset keeps photos and hours. */
const PROFILE_KEY = "jarvis-crm:profiles:v1";

/** Anything at or above this similarity is worth warning a member about. */
const DUPLICATE_THRESHOLD = 0.72;

/**
 * Phase A data provider.
 *
 * Holds the whole dataset in memory, mirrors it to localStorage so edits
 * survive a refresh, and implements exactly the same interface the Supabase
 * provider will implement in Phase B.
 *
 * Deliberate limitation: this is per-browser. Two members will not see each
 * other's edits until Phase B. The interface is identical either way, which is
 * the point — nothing above this file knows or cares where the data lives.
 */
export class MockProvider implements DataProvider {
  readonly mode = "mock" as const;
  private data: SeedData;

  constructor() {
    this.data = this.load();
  }

  /* ---------------------------------------------------------------- *
   * Persistence
   * ---------------------------------------------------------------- */

  private load(): SeedData {
    if (typeof window === "undefined") return buildSeed();
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return buildSeed();
      const parsed = JSON.parse(raw) as SeedData;
      // A seed-shape change invalidates stored demo data rather than
      // half-migrating it — this is throwaway data by design.
      if (parsed.version !== SEED_VERSION) return buildSeed();
      return parsed;
    } catch {
      return buildSeed();
    }
  }

  private save(): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Storage full or blocked (private mode). The session still works;
      // it just will not survive a reload.
    }
  }

  private touch(): void {
    this.save();
  }

  private audit(
    actorId: string,
    entityId: string,
    action: string,
    before: string,
    after: string,
    entity: AuditEntry["entity"] = "client",
  ): void {
    this.data.audit.unshift({
      id: uid("au"),
      actorId,
      entity,
      entityId,
      action,
      before,
      after,
      at: isoNow(),
    });
  }

  /* ---------------------------------------------------------------- *
   * Clients
   * ---------------------------------------------------------------- */

  private toRow(c: Client): ClientRow {
    const mine = this.data.interactions
      .filter((i) => i.clientId === c.id)
      .sort(
        (a, b) =>
          new Date(b.happenedAt).getTime() - new Date(a.happenedAt).getTime(),
      );
    const last = mine[0] ?? null;
    const lastAt = last?.happenedAt ?? c.lastContactAt;
    const days = lastAt
      ? differenceInCalendarDays(new Date(), new Date(lastAt))
      : null;

    return {
      ...c,
      primaryContact:
        this.data.contacts.find((ct) => ct.clientId === c.id && ct.isPrimary) ??
        this.data.contacts.find((ct) => ct.clientId === c.id) ??
        null,
      lastInteraction: last,
      daysSinceContact: days,
      interactionCount: mine.length,
      isStale:
        c.status === "active" &&
        days !== null &&
        days > STALE_AFTER_DAYS,
    };
  }

  async listClients(filter: ClientFilter = {}): Promise<ClientRow[]> {
    let rows = this.data.clients.map((c) => this.toRow(c));

    if (filter.ownerId) {
      rows = rows.filter(
        (r) =>
          r.ownerId === filter.ownerId ||
          r.collaboratorIds.includes(filter.ownerId!),
      );
    }
    if (filter.stage) rows = rows.filter((r) => r.stage === filter.stage);
    if (filter.status) rows = rows.filter((r) => r.status === filter.status);
    if (filter.city) rows = rows.filter((r) => r.city === filter.city);
    if (filter.staleOnly) rows = rows.filter((r) => r.isStale);
    if (filter.deadOnly) rows = rows.filter((r) => r.status === "dead");

    if (filter.search) {
      const q = filter.search.toLowerCase().trim();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.nameAr.includes(q) ||
          r.city.toLowerCase().includes(q) ||
          r.industry.toLowerCase().includes(q) ||
          r.primaryContact?.name.toLowerCase().includes(q),
      );
    }

    // Most recently touched first — the board should answer "what is warm?"
    return rows.sort((a, b) => {
      const at = a.lastContactAt ? new Date(a.lastContactAt).getTime() : 0;
      const bt = b.lastContactAt ? new Date(b.lastContactAt).getTime() : 0;
      return bt - at;
    });
  }

  async getClient(id: string): Promise<ClientDetail | null> {
    const c = this.data.clients.find((x) => x.id === id);
    if (!c) return null;
    return {
      ...this.toRow(c),
      contacts: this.data.contacts.filter((ct) => ct.clientId === id),
      interactions: this.data.interactions
        .filter((i) => i.clientId === id)
        .sort(
          (a, b) =>
            new Date(b.happenedAt).getTime() - new Date(a.happenedAt).getTime(),
        ),
      tasks: this.data.tasks.filter((t) => t.clientId === id),
      history: this.data.audit.filter((a) => a.entityId === id),
    };
  }

  async createClient(input: NewClientInput, actorId: string): Promise<Client> {
    const now = isoNow();
    const client: Client = {
      id: uid("c"),
      name: input.name.trim(),
      nameAr: input.nameAr?.trim() ?? "",
      company: (input.company || input.name).trim(),
      city: input.city ?? "",
      address: input.address ?? "",
      industry: input.industry ?? "",
      website: input.website ?? "",
      sizeGuess: "",
      stage: input.stage,
      status: input.status,
      ownerId: input.ownerId,
      broughtById: input.broughtById,
      collaboratorIds: [],
      source: input.source ?? "",
      referredBy: input.referredBy ?? "",
      dealValueSar: input.dealValueSar ?? null,
      costSar: null,
      whatHappened: input.whatHappened ?? "",
      whatWeOffered: input.whatWeOffered ?? "",
      objection: input.objection ?? "",
      notes: "",
      teamWarning: input.teamWarning ?? "",
      nextAction: input.nextAction ?? "",
      nextActionAt: input.nextActionAt ?? null,
      revisitAfter: input.revisitAfter ?? null,
      closedReason: input.closedReason ?? "",
      closedAt: input.status === "dead" ? now : null,
      closedById: input.status === "dead" ? actorId : "",
      firstContactAt: input.stage === "lead" ? null : now,
      lastContactAt: input.stage === "lead" ? null : now,
      createdById: actorId,
      createdAt: now,
      updatedAt: now,
    };

    this.data.clients.unshift(client);

    if (input.contact?.name) {
      this.data.contacts.push({
        id: uid("ct"),
        clientId: client.id,
        name: input.contact.name,
        title: input.contact.title ?? "",
        phone: input.contact.phone ?? "",
        whatsapp: input.contact.whatsapp ?? "",
        email: input.contact.email ?? "",
        isPrimary: true,
        notes: "",
        preferredChannel: "",
      });
    }

    this.audit(actorId, client.id, "created", "", client.name);
    this.touch();
    return client;
  }

  async updateClient(
    id: string,
    patch: Partial<Client>,
    actorId: string,
  ): Promise<Client> {
    const idx = this.data.clients.findIndex((c) => c.id === id);
    if (idx < 0) throw new Error(`Client ${id} not found`);

    const before = this.data.clients[idx];
    const after = { ...before, ...patch, updatedAt: isoNow() };
    this.data.clients[idx] = after;

    if (patch.ownerId && patch.ownerId !== before.ownerId) {
      this.audit(actorId, id, "owner_changed", before.ownerId, patch.ownerId);
    }
    this.touch();
    return after;
  }

  async setStage(id: string, stage: Stage, actorId: string): Promise<Client> {
    const current = this.data.clients.find((c) => c.id === id);
    if (!current) throw new Error(`Client ${id} not found`);
    if (current.stage === stage) return current;

    const before = current.stage;
    const updated = await this.updateClient(
      id,
      {
        stage,
        // Winning or losing moves the status too — they always travel together.
        status:
          stage === "won"
            ? "won"
            : stage === "lost" && current.status === "active"
              ? "lost_retryable"
              : current.status,
      },
      actorId,
    );

    this.data.interactions.unshift({
      id: uid("i"),
      clientId: id,
      memberId: actorId,
      type: stage === "proposal" ? "proposal_sent" : "follow_up",
      happenedAt: isoNow(),
      durationMin: null,
      summary: `Stage moved from ${before} to ${stage}`,
      outcome: "",
      stageBefore: before,
      stageAfter: stage,
    });

    this.audit(actorId, id, "stage_changed", before, stage);
    this.touch();
    return updated;
  }

  async setStatus(
    id: string,
    status: ClientStatus,
    actorId: string,
    opts: { reason?: string; revisitAfter?: string | null } = {},
  ): Promise<Client> {
    const current = this.data.clients.find((c) => c.id === id);
    if (!current) throw new Error(`Client ${id} not found`);

    if (status === "dead" && !opts.reason?.trim()) {
      throw new Error(
        "A reason is required to mark a client dead — the other members need to know why.",
      );
    }

    const updated = await this.updateClient(
      id,
      {
        status,
        closedReason: status === "dead" ? opts.reason!.trim() : "",
        closedAt: status === "dead" ? isoNow() : null,
        closedById: status === "dead" ? actorId : "",
        revisitAfter: opts.revisitAfter ?? current.revisitAfter,
      },
      actorId,
    );

    this.audit(
      actorId,
      id,
      status === "dead" ? "marked_dead" : "status_changed",
      current.status,
      status,
    );
    this.touch();
    return updated;
  }

  async addCollaborator(clientId: string, memberId: string): Promise<Client> {
    const c = this.data.clients.find((x) => x.id === clientId);
    if (!c) throw new Error(`Client ${clientId} not found`);
    if (c.ownerId === memberId || c.collaboratorIds.includes(memberId)) return c;

    const updated = await this.updateClient(
      clientId,
      { collaboratorIds: [...c.collaboratorIds, memberId] },
      memberId,
    );
    this.audit(memberId, clientId, "collaborator_added", "", memberId);
    this.touch();
    return updated;
  }

  /**
   * The collision check.
   *
   * Runs on every keystroke in the new-client form. Matches on company name
   * similarity and on phone number, then borrows the warning level from the
   * matched client's status — so a dead client produces a hard block while an
   * active one produces an ordinary "already owned by" warning.
   */
  async findPotentialDuplicates(query: {
    name: string;
    company?: string;
    phone?: string;
  }): Promise<DuplicateMatch[]> {
    const needle = (query.company || query.name || "").trim();
    const phone = normalizePhone(query.phone ?? "");
    if (needle.length < 3 && !phone) return [];

    const matches: DuplicateMatch[] = [];

    for (const client of this.data.clients) {
      let score = 0;
      let reason: DuplicateMatch["reason"] = "name";

      if (needle.length >= 3) {
        const byName = similarity(needle, client.name);
        const byCompany = similarity(needle, client.company);
        const byArabic = client.nameAr ? similarity(needle, client.nameAr) : 0;
        score = Math.max(byName, byCompany, byArabic);
        reason = byCompany > byName ? "company" : "name";
      }

      if (phone.length >= 7) {
        const hit = this.data.contacts.some(
          (ct) =>
            ct.clientId === client.id &&
            (normalizePhone(ct.phone) === phone ||
              normalizePhone(ct.whatsapp) === phone),
        );
        if (hit) {
          score = 1;
          reason = "phone";
        }
      }

      if (score >= DUPLICATE_THRESHOLD) {
        const level = statusDef(client.status).warnLevel;
        if (level === "none") continue;
        matches.push({
          client: this.toRow(client),
          score,
          reason,
          level,
        });
      }
    }

    // Blocks first, then by confidence — the dead client must never be
    // buried underneath a weaker "similar name" match.
    const rank = { block: 0, warn: 1, info: 2 } as const;
    return matches
      .sort((a, b) => rank[a.level] - rank[b.level] || b.score - a.score)
      .slice(0, 5);
  }

  /* ---------------------------------------------------------------- *
   * Contacts
   * ---------------------------------------------------------------- */

  async addContact(
    clientId: string,
    contact: Omit<Contact, "id" | "clientId">,
  ): Promise<Contact> {
    const created: Contact = { ...contact, id: uid("ct"), clientId };
    if (created.isPrimary) {
      this.data.contacts
        .filter((c) => c.clientId === clientId)
        .forEach((c) => (c.isPrimary = false));
    }
    this.data.contacts.push(created);
    this.touch();
    return created;
  }

  async updateContact(id: string, patch: Partial<Contact>): Promise<Contact> {
    const idx = this.data.contacts.findIndex((c) => c.id === id);
    if (idx < 0) throw new Error(`Contact ${id} not found`);
    if (patch.isPrimary) {
      const clientId = this.data.contacts[idx].clientId;
      this.data.contacts
        .filter((c) => c.clientId === clientId)
        .forEach((c) => (c.isPrimary = false));
    }
    this.data.contacts[idx] = { ...this.data.contacts[idx], ...patch };
    this.touch();
    return this.data.contacts[idx];
  }

  async deleteContact(id: string): Promise<void> {
    this.data.contacts = this.data.contacts.filter((c) => c.id !== id);
    this.touch();
  }

  /* ---------------------------------------------------------------- *
   * Interactions
   * ---------------------------------------------------------------- */

  async logInteraction(input: NewInteractionInput): Promise<Interaction> {
    const client = this.data.clients.find((c) => c.id === input.clientId);
    if (!client) throw new Error(`Client ${input.clientId} not found`);

    const happenedAt = input.happenedAt ?? isoNow();
    const stageChanged = input.newStage && input.newStage !== client.stage;

    const interaction: Interaction = {
      id: uid("i"),
      clientId: input.clientId,
      memberId: input.memberId,
      type: input.type,
      happenedAt,
      durationMin: input.durationMin ?? null,
      summary: input.summary.trim(),
      outcome: input.outcome?.trim() ?? "",
      stageBefore: stageChanged ? client.stage : null,
      stageAfter: stageChanged ? input.newStage! : null,
    };
    this.data.interactions.unshift(interaction);

    const patch: Partial<Client> = {
      lastContactAt: happenedAt,
      firstContactAt: client.firstContactAt ?? happenedAt,
    };
    if (stageChanged) {
      patch.stage = input.newStage!;
      if (input.newStage === "won") patch.status = "won";
      this.audit(
        input.memberId,
        client.id,
        "stage_changed",
        client.stage,
        input.newStage!,
      );
    }
    // Anyone who logs work on a client they do not own becomes a collaborator,
    // so the board always shows everyone who has actually touched them.
    if (
      input.memberId !== client.ownerId &&
      !client.collaboratorIds.includes(input.memberId)
    ) {
      patch.collaboratorIds = [...client.collaboratorIds, input.memberId];
    }

    await this.updateClient(client.id, patch, input.memberId);
    this.touch();
    return interaction;
  }

  async listInteractions(
    opts: {
      memberId?: string;
      clientId?: string;
      range?: DateRange;
      limit?: number;
    } = {},
  ): Promise<Interaction[]> {
    let rows = [...this.data.interactions];
    if (opts.memberId) rows = rows.filter((i) => i.memberId === opts.memberId);
    if (opts.clientId) rows = rows.filter((i) => i.clientId === opts.clientId);
    if (opts.range) rows = rows.filter((i) => inRange(i.happenedAt, opts.range!));
    rows.sort(
      (a, b) =>
        new Date(b.happenedAt).getTime() - new Date(a.happenedAt).getTime(),
    );
    return opts.limit ? rows.slice(0, opts.limit) : rows;
  }

  /* ---------------------------------------------------------------- *
   * Tasks
   * ---------------------------------------------------------------- */

  async listTasks(
    opts: { assigneeId?: string; clientId?: string; openOnly?: boolean } = {},
  ): Promise<Task[]> {
    let rows = [...this.data.tasks];
    if (opts.assigneeId) rows = rows.filter((t) => t.assigneeId === opts.assigneeId);
    if (opts.clientId) rows = rows.filter((t) => t.clientId === opts.clientId);
    if (opts.openOnly) rows = rows.filter((t) => t.status === "open");
    return rows.sort((a, b) => {
      const at = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
      const bt = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
      return at - bt;
    });
  }

  async createTask(
    input: Omit<Task, "id" | "createdAt" | "completedAt">,
  ): Promise<Task> {
    const task: Task = {
      ...input,
      id: uid("t"),
      createdAt: isoNow(),
      completedAt: null,
    };
    this.data.tasks.unshift(task);
    this.touch();
    return task;
  }

  async toggleTask(id: string, done: boolean): Promise<Task> {
    const idx = this.data.tasks.findIndex((t) => t.id === id);
    if (idx < 0) throw new Error(`Task ${id} not found`);
    this.data.tasks[idx] = {
      ...this.data.tasks[idx],
      status: done ? "done" : "open",
      completedAt: done ? isoNow() : null,
    };
    this.touch();
    return this.data.tasks[idx];
  }

  async deleteTask(id: string): Promise<void> {
    this.data.tasks = this.data.tasks.filter((t) => t.id !== id);
    this.touch();
  }

  /* ---------------------------------------------------------------- *
   * Attendance
   * ---------------------------------------------------------------- */

  async attendanceFor(memberId: string, range: DateRange): Promise<Attendance[]> {
    const keys = new Set(daysInRange(range));
    return this.data.attendance
      .filter((a) => a.memberId === memberId && keys.has(a.date))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async attendanceToday(memberId: string): Promise<Attendance | null> {
    const today = toDateKey(new Date());
    return (
      this.data.attendance.find(
        (a) => a.memberId === memberId && a.date === today,
      ) ?? null
    );
  }

  private blankAttendance(memberId: string, date: string): Attendance {
    const member = MEMBERS.find((m) => m.id === memberId);
    return {
      id: `${memberId}_${date}`,
      memberId,
      date,
      checkInAt: null,
      checkOutAt: null,
      plannedStart: member?.plannedStart ?? DEFAULT_START,
      plannedEnd: member?.plannedEnd ?? DEFAULT_END,
      status: "absent",
      reason: "",
      minutesWorked: 0,
    };
  }

  private recompute(a: Attendance): Attendance {
    if (!a.checkInAt) return { ...a, minutesWorked: 0 };

    const startPlanned = toMinutes(a.plannedStart);
    const endPlanned = toMinutes(a.plannedEnd);
    const inMin = minutesOfDay(a.checkInAt);
    const outMin = a.checkOutAt ? minutesOfDay(a.checkOutAt) : null;

    // Only time inside the planned window counts. Turning up at 07:00 does not
    // earn credit, and neither does staying until 18:00 — the score measures
    // coverage of the agreed hours, not raw hours.
    const covered =
      outMin === null
        ? 0
        : Math.max(0, Math.min(outMin, endPlanned) - Math.max(inMin, startPlanned));

    const late = inMin > startPlanned + LATE_GRACE_MINUTES;
    const early =
      outMin !== null && outMin < endPlanned - EARLY_LEAVE_GRACE_MINUTES;

    return {
      ...a,
      minutesWorked: covered,
      status: late ? "late" : early ? "left_early" : "present",
    };
  }

  /**
   * The timesheet write.
   *
   * "09:15" on 2026-07-19 becomes a real timestamp on that date. Because the
   * times are typed rather than clocked, a member can fill Sunday in on
   * Wednesday — which is how this actually gets used.
   */
  async setHours(
    memberId: string,
    date: string,
    hours: {
      checkIn: string | null;
      checkOut: string | null;
      reason?: string;
      absent?: boolean;
    },
  ): Promise<Attendance> {
    const existing = this.data.attendance.find(
      (a) => a.memberId === memberId && a.date === date,
    );
    const base = existing ?? this.blankAttendance(memberId, date);

    const toStamp = (hhmm: string | null): string | null => {
      if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
      const [h, min] = hhmm.split(":").map(Number);
      const d = fromDateKey(date);
      d.setHours(h, min, 0, 0);
      return d.toISOString();
    };

    const merged: Attendance = {
      ...base,
      checkInAt: hours.absent ? null : toStamp(hours.checkIn),
      checkOutAt: hours.absent ? null : toStamp(hours.checkOut),
      reason: hours.reason ?? base.reason,
    };

    const updated = hours.absent
      ? { ...merged, status: "absent" as const, minutesWorked: 0 }
      : merged.checkInAt
        ? this.recompute(merged)
        : { ...merged, status: "absent" as const, minutesWorked: 0, reason: hours.reason ?? "" };

    if (existing) {
      this.data.attendance[this.data.attendance.indexOf(existing)] = updated;
    } else {
      this.data.attendance.push(updated);
    }
    this.touch();
    return updated;
  }

  async setAttendance(
    memberId: string,
    date: string,
    patch: Partial<Attendance>,
  ): Promise<Attendance> {
    const existing = this.data.attendance.find(
      (a) => a.memberId === memberId && a.date === date,
    );
    const base = existing ?? this.blankAttendance(memberId, date);
    const merged = { ...base, ...patch };
    const updated =
      merged.status === "off" || merged.status === "approved_off"
        ? { ...merged, minutesWorked: 0 }
        : this.recompute(merged);

    if (existing) {
      this.data.attendance[this.data.attendance.indexOf(existing)] = updated;
    } else {
      this.data.attendance.push(updated);
    }
    this.touch();
    return updated;
  }

  /* ---------------------------------------------------------------- *
   * Schedule
   * ---------------------------------------------------------------- */

  async listScheduleDays(range: DateRange): Promise<ScheduleDay[]> {
    const keys = new Set(daysInRange(range));
    return this.data.schedule.filter((s) => keys.has(s.date));
  }

  async decideDay(
    date: string,
    memberId: string | null,
    dayType: ScheduleDay["dayType"],
    actorId: string,
    note = "",
  ): Promise<ScheduleDay> {
    const existing = this.data.schedule.find(
      (s) => s.date === date && s.memberId === memberId,
    );
    const record: ScheduleDay = existing
      ? { ...existing, dayType, decidedById: actorId, note }
      : { id: uid("sd"), date, memberId, dayType, decidedById: actorId, note };

    if (existing) {
      this.data.schedule[this.data.schedule.indexOf(existing)] = record;
    } else {
      this.data.schedule.push(record);
    }
    this.audit(
      actorId,
      record.id,
      "day_decided",
      existing?.dayType ?? "",
      dayType,
      "schedule",
    );
    this.touch();
    return record;
  }

  /* ---------------------------------------------------------------- *
   * Stats
   * ---------------------------------------------------------------- */

  async memberStats(memberId: string, range: DateRange): Promise<MemberStats> {
    const interactions = await this.listInteractions({ memberId, range });
    const attendance = await this.attendanceFor(memberId, range);
    const allTasks = this.data.tasks.filter((t) => t.assigneeId === memberId);
    const tasksInRange = allTasks.filter(
      (t) => t.dueAt && inRange(t.dueAt, range),
    );

    const touched = new Set(interactions.map((i) => i.clientId));
    const clientsOwned = this.data.clients.filter(
      (c) => c.ownerId === memberId || c.collaboratorIds.includes(memberId),
    );

    const stageAdvances = interactions.filter(
      (i) => i.stageBefore && i.stageAfter && isAdvance(i.stageBefore, i.stageAfter),
    ).length;
    const proposalsSent = interactions.filter(
      (i) => i.type === "proposal_sent",
    ).length;

    const efficiency = computeEfficiency({
      // Field days always count. Wednesday and Thursday only count once a
      // member has actually entered hours for them — which happens when the
      // Tuesday review turns them into working days.
      attendance: attendance.filter(
        (a) => isScoredDay(fromDateKey(a.date).getDay()) || Boolean(a.checkInAt),
      ),
      interactions,
      tasks: tasksInRange,
      stageAdvances,
      proposalsSent,
    });

    const byDay = new Map<string, number>();
    for (const key of daysInRange(range)) byDay.set(key, 0);
    for (const i of interactions) {
      const key = toDateKey(i.happenedAt);
      if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }

    const now = new Date();
    return {
      memberId,
      range,
      clientsTouched: touched.size,
      newClients: clientsOwned.filter((c) => inRange(c.createdAt, range)).length,
      interactions: interactions.length,
      visits: interactions.filter((i) => i.type === "visit").length,
      meetings: interactions.filter((i) => i.type === "meeting").length,
      calls: interactions.filter((i) => i.type === "call").length,
      proposalsSent,
      stageAdvances,
      won: clientsOwned.filter(
        (c) => c.status === "won" && inRange(c.updatedAt, range),
      ).length,
      lost: clientsOwned.filter((c) => c.status === "lost_retryable").length,
      dead: clientsOwned.filter((c) => c.status === "dead").length,
      tasksDone: allTasks.filter(
        (t) => t.status === "done" && t.completedAt && inRange(t.completedAt, range),
      ).length,
      tasksOpen: allTasks.filter((t) => t.status === "open").length,
      tasksOverdue: allTasks.filter(
        (t) => t.status === "open" && t.dueAt && new Date(t.dueAt) < now,
      ).length,
      minutesWorked: efficiency.detail.minutesWorked,
      minutesPlanned: efficiency.detail.minutesPlanned,
      daysPresent: attendance.filter(
        (a) => a.status === "present" || a.status === "late" || a.status === "left_early",
      ).length,
      daysLate: attendance.filter((a) => a.status === "late").length,
      daysAbsent: attendance.filter((a) => a.status === "absent").length,
      efficiency,
      activityByDay: [...byDay.entries()].map(([date, count]) => ({ date, count })),
    };
  }

  async teamStats(range: DateRange): Promise<MemberStats[]> {
    return Promise.all(MEMBERS.map((m) => this.memberStats(m.id, range)));
  }

  /* ---------------------------------------------------------------- *
   * Reminders
   * ---------------------------------------------------------------- */

  async listReminders(
    memberId: string,
    opts: { includeDone?: boolean } = {},
  ): Promise<Reminder[]> {
    return this.data.reminders
      .filter(
        (r) =>
          (r.memberId === memberId || r.sharedWith.includes(memberId)) &&
          (opts.includeDone ? true : !r.done),
      )
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  async createReminder(
    input: Omit<
      Reminder,
      "id" | "createdAt" | "done" | "completedAt" | "snoozedUntil"
    >,
  ): Promise<Reminder> {
    const reminder: Reminder = {
      ...input,
      id: uid("rem"),
      done: false,
      completedAt: null,
      snoozedUntil: null,
      createdAt: isoNow(),
    };
    this.data.reminders.unshift(reminder);
    this.touch();
    return reminder;
  }

  async updateReminder(id: string, patch: Partial<Reminder>): Promise<Reminder> {
    const idx = this.data.reminders.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error(`Reminder ${id} not found`);
    this.data.reminders[idx] = { ...this.data.reminders[idx], ...patch };
    this.touch();
    return this.data.reminders[idx];
  }

  async completeReminder(id: string, done: boolean): Promise<Reminder> {
    return this.updateReminder(id, {
      done,
      completedAt: done ? isoNow() : null,
    });
  }

  async snoozeReminder(id: string, untilDate: string): Promise<Reminder> {
    return this.updateReminder(id, { snoozedUntil: untilDate });
  }

  async deleteReminder(id: string): Promise<void> {
    this.data.reminders = this.data.reminders.filter((r) => r.id !== id);
    this.touch();
  }

  /**
   * Turns silence into a nudge.
   *
   * An active client nobody has touched for STALE_AFTER_DAYS gets a reminder
   * created for its owner, once. Re-running is safe — an existing auto
   * reminder for the same client is left alone rather than duplicated.
   */
  async refreshAutoReminders(memberId: string): Promise<Reminder[]> {
    const created: Reminder[] = [];
    const today = toDateKey(new Date());

    for (const client of this.data.clients) {
      if (client.ownerId !== memberId) continue;
      if (client.status !== "active") continue;

      const row = this.toRow(client);
      if (!row.isStale) continue;

      const already = this.data.reminders.some(
        (r) => r.auto && r.clientId === client.id && !r.done,
      );
      if (already) continue;

      created.push(
        await this.createReminder({
          memberId,
          title: `${client.name} has gone quiet`,
          note: `No contact for ${row.daysSinceContact} days. ${
            client.nextAction || "Decide whether to chase or let it go."
          }`,
          dueDate: today,
          warnDaysBefore: 0,
          clientId: client.id,
          sharedWith: [],
          auto: true,
        }),
      );
    }

    return created;
  }

  /* ---------------------------------------------------------------- *
   * Routes
   * ---------------------------------------------------------------- */

  async listRoutes(
    memberId: string,
    opts: { from?: string } = {},
  ): Promise<DayRoute[]> {
    return this.data.routes
      .filter(
        (r) => r.memberId === memberId && (!opts.from || r.date >= opts.from),
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getRoute(id: string): Promise<DayRoute | null> {
    return this.data.routes.find((r) => r.id === id) ?? null;
  }

  async createRoute(
    memberId: string,
    date: string,
    title: string,
  ): Promise<DayRoute> {
    const route: DayRoute = {
      id: uid("rt"),
      memberId,
      date,
      title,
      stops: [],
      createdAt: isoNow(),
    };
    this.data.routes.push(route);
    this.touch();
    return route;
  }

  async updateRoute(id: string, patch: Partial<DayRoute>): Promise<DayRoute> {
    const idx = this.data.routes.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error(`Route ${id} not found`);
    this.data.routes[idx] = { ...this.data.routes[idx], ...patch };
    this.touch();
    return this.data.routes[idx];
  }

  async deleteRoute(id: string): Promise<void> {
    this.data.routes = this.data.routes.filter((r) => r.id !== id);
    this.touch();
  }

  /* ---------------------------------------------------------------- *
   * Chat
   * ---------------------------------------------------------------- */

  private inThread(msg: Message, memberId: string, withId: string | null): boolean {
    if (withId === null) return msg.toId === null;
    return (
      (msg.fromId === memberId && msg.toId === withId) ||
      (msg.fromId === withId && msg.toId === memberId)
    );
  }

  async listThreads(memberId: string): Promise<ThreadSummary[]> {
    const partners: (string | null)[] = [
      null,
      ...MEMBERS.filter((m) => m.id !== memberId).map((m) => m.id),
    ];

    return partners.map((withId) => {
      const msgs = this.data.messages
        .filter((msg) => this.inThread(msg, memberId, withId))
        .sort((a, b) => a.sentAt.localeCompare(b.sentAt));

      return {
        withId,
        lastMessage: msgs[msgs.length - 1] ?? null,
        unread: msgs.filter(
          (msg) => msg.fromId !== memberId && !msg.readBy.includes(memberId),
        ).length,
      };
    });
  }

  async listMessages(memberId: string, withId: string | null): Promise<Message[]> {
    return this.data.messages
      .filter((msg) => this.inThread(msg, memberId, withId))
      .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  }

  async sendMessage(
    fromId: string,
    toId: string | null,
    body: string,
    clientId: string | null = null,
  ): Promise<Message> {
    const message: Message = {
      id: uid("msg"),
      fromId,
      toId,
      body: body.trim(),
      sentAt: isoNow(),
      readBy: [fromId],
      clientId,
    };
    this.data.messages.push(message);
    this.touch();
    return message;
  }

  async markThreadRead(memberId: string, withId: string | null): Promise<void> {
    for (const msg of this.data.messages) {
      if (!this.inThread(msg, memberId, withId)) continue;
      if (!msg.readBy.includes(memberId)) msg.readBy.push(memberId);
    }
    this.touch();
  }

  /* ---------------------------------------------------------------- *
   * Profile
   * ---------------------------------------------------------------- */

  async getProfile(memberId: string): Promise<MemberProfile> {
    const stored = this.readProfiles()[memberId];
    const member = MEMBERS.find((m) => m.id === memberId);
    return (
      stored ?? {
        memberId,
        photo: "",
        plannedStart: member?.plannedStart ?? DEFAULT_START,
        plannedEnd: member?.plannedEnd ?? DEFAULT_END,
        phone: member?.phone ?? "",
        updatedAt: isoNow(),
      }
    );
  }

  async updateProfile(
    memberId: string,
    patch: Partial<MemberProfile>,
  ): Promise<MemberProfile> {
    const current = await this.getProfile(memberId);
    const next = { ...current, ...patch, memberId, updatedAt: isoNow() };
    const all = this.readProfiles();
    all[memberId] = next;
    this.writeProfiles(all);
    return next;
  }

  /**
   * Profiles live in their own storage key rather than the main payload, so
   * "reset to a clean system" never wipes someone's photo and hours.
   */
  private readProfiles(): Record<string, MemberProfile> {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(window.localStorage.getItem(PROFILE_KEY) ?? "{}");
    } catch {
      return {};
    }
  }

  private writeProfiles(all: Record<string, MemberProfile>): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(all));
    } catch {
      // Photo too large for the quota — the rest of the profile still saved.
    }
  }

  /* ---------------------------------------------------------------- *
   * Bulk import
   * ---------------------------------------------------------------- */

  async importClients(
    rows: ParsedClientRow[],
    ownerId: string,
  ): Promise<{ created: number; joined: number; skipped: number }> {
    let created = 0;
    let joined = 0;
    let skipped = 0;

    for (const row of rows) {
      if (!row.include || !row.name.trim()) {
        skipped++;
        continue;
      }

      // Already somebody's client: join it rather than making a second copy.
      if (row.duplicateOf) {
        await this.addCollaborator(row.duplicateOf.clientId, ownerId);
        if (row.whatHappened.trim()) {
          await this.logInteraction({
            clientId: row.duplicateOf.clientId,
            memberId: ownerId,
            type: "visit",
            summary: row.whatHappened.trim(),
          });
        }
        joined++;
        continue;
      }

      await this.createClient(
        {
          name: row.name.trim(),
          city: row.city.trim(),
          address: "",
          stage: row.stage,
          status: row.status,
          ownerId,
          broughtById: ownerId,
          source: "Bulk import",
          whatHappened: row.whatHappened.trim(),
          closedReason: row.closedReason.trim(),
          dealValueSar: row.dealValueSar,
          contact: row.contactName.trim() || row.contactPhone.trim()
            ? {
                name: row.contactName.trim() || row.name.trim(),
                phone: row.contactPhone.trim(),
                whatsapp: row.contactPhone.trim(),
              }
            : undefined,
        },
        ownerId,
      );
      created++;
    }

    this.touch();
    return { created, joined, skipped };
  }

  async importActivity(
    rows: ParsedActivityRow[],
    memberId: string,
  ): Promise<{ created: number }> {
    let created = 0;

    for (const row of rows) {
      if (!row.include || !row.clientId || !row.summary.trim()) continue;

      // Midday on the stated day, so it lands on the right date whatever time
      // the member is typing this up.
      await this.logInteraction({
        clientId: row.clientId,
        memberId,
        type: row.type,
        summary: row.summary.trim(),
        happenedAt: new Date(`${row.date}T${row.time || "12:00"}:00`).toISOString(),
      });
      created++;
    }

    this.touch();
    return { created };
  }

  async importTasks(
    rows: ParsedTaskRow[],
    assigneeId: string,
  ): Promise<{ created: number }> {
    let created = 0;
    for (const row of rows) {
      if (!row.include || !row.title.trim()) continue;
      await this.createTask({
        title: row.title.trim(),
        clientId: row.clientId || null,
        assigneeId,
        dueAt: row.dueAt ? `${row.dueAt}T09:00:00.000Z` : null,
        status: "open",
        priority: row.priority,
      });
      created++;
    }
    this.touch();
    return { created };
  }

  /* ---------------------------------------------------------------- *
   * Audit + housekeeping
   * ---------------------------------------------------------------- */

  async listAudit(entityId?: string): Promise<AuditEntry[]> {
    const rows = entityId
      ? this.data.audit.filter((a) => a.entityId === entityId)
      : this.data.audit;
    return [...rows].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  }

  async resetToSeed(): Promise<void> {
    this.data = buildSeed();
    this.touch();
  }

  async exportAll(): Promise<string> {
    return JSON.stringify(this.data, null, 2);
  }

  async importAll(json: string): Promise<void> {
    const parsed = JSON.parse(json) as SeedData;
    this.data = parsed;
    this.touch();
  }

  /** Used by the calendar to project the fixed week forward. */
  nextFieldDay(from: Date = new Date()): Date {
    let cursor = addDays(from, 1);
    for (let i = 0; i < 7; i++) {
      if (isScoredDay(cursor.getDay())) return cursor;
      cursor = addDays(cursor, 1);
    }
    return cursor;
  }
}
