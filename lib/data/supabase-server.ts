import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { addDays, differenceInCalendarDays } from "date-fns";
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

/**
 * The real database, reached only from the server.
 *
 * This file must never be imported by a component. It holds the service_role
 * key, which bypasses Row Level Security — every table has RLS on with no
 * policies, so this is the *only* way anything reads or writes. The browser
 * talks to /api/db, which checks the session cookie first.
 *
 * Column names in Postgres are the snake_case of the app's field names, so a
 * single pair of converters replaces a hand-written mapper per table.
 */

const DUPLICATE_THRESHOLD = 0.72;

function snake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function camel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function toRow<T extends object>(obj: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [snake(k), v]),
  );
}

function fromRow<T>(row: Record<string, unknown> | null): T {
  if (!row) return null as T;
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [camel(k), v]),
  ) as T;
}

function fromRows<T>(rows: Record<string, unknown>[] | null): T[] {
  return (rows ?? []).map((r) => fromRow<T>(r));
}

/** Numeric columns come back from PostgREST as strings; the app wants numbers. */
function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export class SupabaseServerProvider implements DataProvider {
  readonly mode = "supabase" as const;
  private sb: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_KEY must both be set on the server.",
      );
    }
    this.sb = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /* ---------------------------------------------------------------- *
   * Clients
   * ---------------------------------------------------------------- */

  private async decorate(clients: Client[]): Promise<ClientRow[]> {
    if (clients.length === 0) return [];
    const ids = clients.map((c) => c.id);

    const [{ data: contactRows }, { data: interactionRows }] = await Promise.all([
      this.sb.from("contacts").select("*").in("client_id", ids),
      this.sb
        .from("interactions")
        .select("*")
        .in("client_id", ids)
        .order("happened_at", { ascending: false }),
    ]);

    const contacts = fromRows<Contact>(contactRows);
    const interactions = fromRows<Interaction>(interactionRows);

    return clients.map((c) => {
      const mine = interactions.filter((i) => i.clientId === c.id);
      const last = mine[0] ?? null;
      const lastAt = last?.happenedAt ?? c.lastContactAt;
      const days = lastAt
        ? differenceInCalendarDays(new Date(), new Date(lastAt))
        : null;

      return {
        ...c,
        dealValueSar: numeric(c.dealValueSar),
        costSar: numeric(c.costSar),
        collaboratorIds: c.collaboratorIds ?? [],
        primaryContact:
          contacts.find((ct) => ct.clientId === c.id && ct.isPrimary) ??
          contacts.find((ct) => ct.clientId === c.id) ??
          null,
        lastInteraction: last,
        daysSinceContact: days,
        interactionCount: mine.length,
        isStale:
          c.status === "active" && days !== null && days > STALE_AFTER_DAYS,
      };
    });
  }

  async listClients(rawFilter: ClientFilter | null = {}): Promise<ClientRow[]> {
    // Defaults only apply to `undefined`; anything crossing JSON arrives as
    // null, so normalise here rather than trusting every caller.
    const filter = rawFilter ?? {};
    let q = this.sb.from("clients").select("*");
    if (filter.stage) q = q.eq("stage", filter.stage);
    if (filter.status) q = q.eq("status", filter.status);
    if (filter.city) q = q.eq("city", filter.city);
    if (filter.deadOnly) q = q.eq("status", "dead");

    const { data, error } = await q.order("last_contact_at", {
      ascending: false,
      nullsFirst: false,
    });
    if (error) throw new Error(error.message);

    let rows = await this.decorate(fromRows<Client>(data));

    // Ownership covers collaborators too, which is easier to express here
    // than as a PostgREST filter over an array column.
    if (filter.ownerId) {
      rows = rows.filter(
        (r) =>
          r.ownerId === filter.ownerId ||
          r.collaboratorIds.includes(filter.ownerId!),
      );
    }
    if (filter.staleOnly) rows = rows.filter((r) => r.isStale);
    if (filter.search) {
      const s = filter.search.toLowerCase().trim();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          r.nameAr.includes(s) ||
          r.city.toLowerCase().includes(s) ||
          r.industry.toLowerCase().includes(s),
      );
    }
    return rows;
  }

  async getClient(id: string): Promise<ClientDetail | null> {
    const { data } = await this.sb.from("clients").select("*").eq("id", id).maybeSingle();
    if (!data) return null;

    const [row] = await this.decorate([fromRow<Client>(data)]);

    const [contacts, interactions, tasks, history] = await Promise.all([
      this.sb.from("contacts").select("*").eq("client_id", id),
      this.sb
        .from("interactions")
        .select("*")
        .eq("client_id", id)
        .order("happened_at", { ascending: false }),
      this.sb.from("tasks").select("*").eq("client_id", id),
      this.sb.from("audit_log").select("*").eq("entity_id", id).order("at", { ascending: false }),
    ]);

    return {
      ...row,
      contacts: fromRows<Contact>(contacts.data),
      interactions: fromRows<Interaction>(interactions.data),
      tasks: fromRows<Task>(tasks.data),
      history: fromRows<AuditEntry>(history.data),
    };
  }

  private async audit(
    actorId: string,
    entityId: string,
    action: string,
    before: string,
    after: string,
    entity: AuditEntry["entity"] = "client",
  ): Promise<void> {
    await this.sb.from("audit_log").insert(
      toRow({
        id: uid("au"),
        actorId,
        entity,
        entityId,
        action,
        before,
        after,
        at: isoNow(),
      }),
    );
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

    const { error } = await this.sb.from("clients").insert(toRow(client));
    if (error) throw new Error(error.message);

    if (input.contact?.name) {
      await this.addContact(client.id, {
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

    await this.audit(actorId, client.id, "created", "", client.name);
    return client;
  }

  async updateClient(
    id: string,
    patch: Partial<Client>,
    actorId: string,
  ): Promise<Client> {
    const { data: existing } = await this.sb
      .from("clients")
      .select("owner_id")
      .eq("id", id)
      .maybeSingle();

    const { data, error } = await this.sb
      .from("clients")
      .update(toRow({ ...patch, updatedAt: isoNow() }))
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (patch.ownerId && existing && patch.ownerId !== existing.owner_id) {
      await this.audit(
        actorId,
        id,
        "owner_changed",
        String(existing.owner_id),
        patch.ownerId,
      );
    }
    return fromRow<Client>(data);
  }

  async setStage(id: string, stage: Stage, actorId: string): Promise<Client> {
    const { data: current } = await this.sb
      .from("clients")
      .select("stage,status")
      .eq("id", id)
      .maybeSingle();
    if (!current) throw new Error(`Client ${id} not found`);
    if (current.stage === stage) return this.getClientRaw(id);

    const before = current.stage as Stage;
    const updated = await this.updateClient(
      id,
      {
        stage,
        status:
          stage === "won"
            ? "won"
            : stage === "lost" && current.status === "active"
              ? "lost_retryable"
              : (current.status as ClientStatus),
      },
      actorId,
    );

    await this.sb.from("interactions").insert(
      toRow({
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
      }),
    );
    await this.audit(actorId, id, "stage_changed", before, stage);
    return updated;
  }

  private async getClientRaw(id: string): Promise<Client> {
    const { data } = await this.sb.from("clients").select("*").eq("id", id).single();
    return fromRow<Client>(data);
  }

  async setStatus(
    id: string,
    status: ClientStatus,
    actorId: string,
    rawOpts: { reason?: string; revisitAfter?: string | null } | null = {},
  ): Promise<Client> {
    const opts = rawOpts ?? {};
    const { data: current } = await this.sb
      .from("clients")
      .select("status,revisit_after")
      .eq("id", id)
      .maybeSingle();
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
        revisitAfter:
          opts.revisitAfter !== undefined
            ? opts.revisitAfter
            : (current.revisit_after as string | null),
      },
      actorId,
    );

    await this.audit(
      actorId,
      id,
      status === "dead" ? "marked_dead" : "status_changed",
      String(current.status),
      status,
    );
    return updated;
  }

  async addCollaborator(clientId: string, memberId: string): Promise<Client> {
    const c = await this.getClientRaw(clientId);
    const ids = c.collaboratorIds ?? [];
    if (c.ownerId === memberId || ids.includes(memberId)) return c;

    const updated = await this.updateClient(
      clientId,
      { collaboratorIds: [...ids, memberId] },
      memberId,
    );
    await this.audit(memberId, clientId, "collaborator_added", "", memberId);
    return updated;
  }

  async findPotentialDuplicates(query: {
    name: string;
    company?: string;
    phone?: string;
  }): Promise<DuplicateMatch[]> {
    const needle = (query.company || query.name || "").trim();
    const phone = normalizePhone(query.phone ?? "");
    if (needle.length < 3 && !phone) return [];

    const all = await this.listClients();
    const matches: DuplicateMatch[] = [];

    let phoneClientIds: string[] = [];
    if (phone.length >= 7) {
      const { data } = await this.sb.from("contacts").select("client_id,phone,whatsapp");
      phoneClientIds = (data ?? [])
        .filter(
          (r) =>
            normalizePhone(String(r.phone ?? "")) === phone ||
            normalizePhone(String(r.whatsapp ?? "")) === phone,
        )
        .map((r) => String(r.client_id));
    }

    for (const client of all) {
      let score = 0;
      let reason: DuplicateMatch["reason"] = "name";

      if (needle.length >= 3) {
        const byName = similarity(needle, client.name);
        const byCompany = similarity(needle, client.company);
        const byArabic = client.nameAr ? similarity(needle, client.nameAr) : 0;
        score = Math.max(byName, byCompany, byArabic);
        reason = byCompany > byName ? "company" : "name";
      }
      if (phoneClientIds.includes(client.id)) {
        score = 1;
        reason = "phone";
      }

      if (score >= DUPLICATE_THRESHOLD) {
        const level = statusDef(client.status).warnLevel;
        if (level === "none") continue;
        matches.push({ client, score, reason, level });
      }
    }

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
    if (contact.isPrimary) {
      await this.sb.from("contacts").update({ is_primary: false }).eq("client_id", clientId);
    }
    const created: Contact = { ...contact, id: uid("ct"), clientId };
    const { error } = await this.sb.from("contacts").insert(toRow(created));
    if (error) throw new Error(error.message);
    return created;
  }

  async updateContact(id: string, patch: Partial<Contact>): Promise<Contact> {
    if (patch.isPrimary) {
      const { data } = await this.sb.from("contacts").select("client_id").eq("id", id).maybeSingle();
      if (data) {
        await this.sb
          .from("contacts")
          .update({ is_primary: false })
          .eq("client_id", data.client_id);
      }
    }
    const { data, error } = await this.sb
      .from("contacts")
      .update(toRow(patch))
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return fromRow<Contact>(data);
  }

  async deleteContact(id: string): Promise<void> {
    await this.sb.from("contacts").delete().eq("id", id);
  }

  /* ---------------------------------------------------------------- *
   * Interactions
   * ---------------------------------------------------------------- */

  async logInteraction(input: NewInteractionInput): Promise<Interaction> {
    const client = await this.getClientRaw(input.clientId);
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
    const { error } = await this.sb.from("interactions").insert(toRow(interaction));
    if (error) throw new Error(error.message);

    const patch: Partial<Client> = {
      lastContactAt: happenedAt,
      firstContactAt: client.firstContactAt ?? happenedAt,
    };
    if (stageChanged) {
      patch.stage = input.newStage!;
      if (input.newStage === "won") patch.status = "won";
      await this.audit(
        input.memberId,
        client.id,
        "stage_changed",
        client.stage,
        input.newStage!,
      );
    }
    const collaborators = client.collaboratorIds ?? [];
    if (input.memberId !== client.ownerId && !collaborators.includes(input.memberId)) {
      patch.collaboratorIds = [...collaborators, input.memberId];
    }

    await this.updateClient(client.id, patch, input.memberId);
    return interaction;
  }

  async listInteractions(
    raw: {
      memberId?: string;
      clientId?: string;
      range?: DateRange;
      limit?: number;
    } | null = {},
  ): Promise<Interaction[]> {
    const opts = raw ?? {};
    let q = this.sb.from("interactions").select("*");
    if (opts.memberId) q = q.eq("member_id", opts.memberId);
    if (opts.clientId) q = q.eq("client_id", opts.clientId);
    if (opts.range) q = q.gte("happened_at", opts.range.from).lte("happened_at", opts.range.to);
    q = q.order("happened_at", { ascending: false });
    if (opts.limit) q = q.limit(opts.limit);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return fromRows<Interaction>(data);
  }

  /* ---------------------------------------------------------------- *
   * Tasks
   * ---------------------------------------------------------------- */

  async listTasks(
    raw: { assigneeId?: string; clientId?: string; openOnly?: boolean } | null = {},
  ): Promise<Task[]> {
    const opts = raw ?? {};
    let q = this.sb.from("tasks").select("*");
    if (opts.assigneeId) q = q.eq("assignee_id", opts.assigneeId);
    if (opts.clientId) q = q.eq("client_id", opts.clientId);
    if (opts.openOnly) q = q.eq("status", "open");
    const { data, error } = await q.order("due_at", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return fromRows<Task>(data);
  }

  async createTask(
    input: Omit<Task, "id" | "createdAt" | "completedAt">,
  ): Promise<Task> {
    const task: Task = { ...input, id: uid("t"), createdAt: isoNow(), completedAt: null };
    const { error } = await this.sb.from("tasks").insert(toRow(task));
    if (error) throw new Error(error.message);
    return task;
  }

  async toggleTask(id: string, done: boolean): Promise<Task> {
    const { data, error } = await this.sb
      .from("tasks")
      .update(toRow({ status: done ? "done" : "open", completedAt: done ? isoNow() : null }))
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return fromRow<Task>(data);
  }

  async deleteTask(id: string): Promise<void> {
    await this.sb.from("tasks").delete().eq("id", id);
  }

  /* ---------------------------------------------------------------- *
   * Attendance
   * ---------------------------------------------------------------- */

  async attendanceFor(memberId: string, range: DateRange): Promise<Attendance[]> {
    const keys = daysInRange(range);
    const { data, error } = await this.sb
      .from("attendance")
      .select("*")
      .eq("member_id", memberId)
      .gte("date", keys[0])
      .lte("date", keys[keys.length - 1])
      .order("date");
    if (error) throw new Error(error.message);
    return fromRows<Attendance>(data);
  }

  async attendanceToday(memberId: string): Promise<Attendance | null> {
    const { data } = await this.sb
      .from("attendance")
      .select("*")
      .eq("member_id", memberId)
      .eq("date", toDateKey(new Date()))
      .maybeSingle();
    return data ? fromRow<Attendance>(data) : null;
  }

  private recompute(a: Attendance): Attendance {
    if (!a.checkInAt) return { ...a, minutesWorked: 0 };
    const startPlanned = toMinutes(a.plannedStart);
    const endPlanned = toMinutes(a.plannedEnd);
    const inMin = minutesOfDay(a.checkInAt);
    const outMin = a.checkOutAt ? minutesOfDay(a.checkOutAt) : null;

    const covered =
      outMin === null
        ? 0
        : Math.max(0, Math.min(outMin, endPlanned) - Math.max(inMin, startPlanned));
    const late = inMin > startPlanned + LATE_GRACE_MINUTES;
    const early = outMin !== null && outMin < endPlanned - EARLY_LEAVE_GRACE_MINUTES;

    return {
      ...a,
      minutesWorked: covered,
      status: late ? "late" : early ? "left_early" : "present",
    };
  }

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
    const member = MEMBERS.find((x) => x.id === memberId);
    const { data: existing } = await this.sb
      .from("attendance")
      .select("*")
      .eq("member_id", memberId)
      .eq("date", date)
      .maybeSingle();

    const base: Attendance = existing
      ? fromRow<Attendance>(existing)
      : {
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

    const stamp = (hhmm: string | null): string | null => {
      if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
      const [h, min] = hhmm.split(":").map(Number);
      const d = fromDateKey(date);
      d.setHours(h, min, 0, 0);
      return d.toISOString();
    };

    const merged: Attendance = {
      ...base,
      checkInAt: hours.absent ? null : stamp(hours.checkIn),
      checkOutAt: hours.absent ? null : stamp(hours.checkOut),
      reason: hours.reason ?? base.reason,
    };

    const updated =
      hours.absent || !merged.checkInAt
        ? { ...merged, status: "absent" as const, minutesWorked: 0 }
        : this.recompute(merged);

    const { error } = await this.sb
      .from("attendance")
      .upsert(toRow(updated), { onConflict: "member_id,date" });
    if (error) throw new Error(error.message);
    return updated;
  }

  async setAttendance(
    memberId: string,
    date: string,
    patch: Partial<Attendance>,
  ): Promise<Attendance> {
    const current = (await this.attendanceFor(memberId, {
      key: "week",
      from: `${date}T00:00:00.000Z`,
      to: `${date}T23:59:59.999Z`,
      label: "",
    }))[0];

    const merged = { ...(current ?? {}), ...patch, memberId, date } as Attendance;
    const updated =
      merged.status === "off" || merged.status === "approved_off"
        ? { ...merged, minutesWorked: 0 }
        : this.recompute(merged);

    const { error } = await this.sb
      .from("attendance")
      .upsert(toRow({ ...updated, id: updated.id || `${memberId}_${date}` }), {
        onConflict: "member_id,date",
      });
    if (error) throw new Error(error.message);
    return updated;
  }

  /* ---------------------------------------------------------------- *
   * Schedule
   * ---------------------------------------------------------------- */

  async listScheduleDays(range: DateRange): Promise<ScheduleDay[]> {
    const keys = daysInRange(range);
    const { data, error } = await this.sb
      .from("schedule_days")
      .select("*")
      .gte("date", keys[0])
      .lte("date", keys[keys.length - 1]);
    if (error) throw new Error(error.message);
    return fromRows<ScheduleDay>(data);
  }

  async decideDay(
    date: string,
    memberId: string | null,
    dayType: ScheduleDay["dayType"],
    actorId: string,
    note = "",
  ): Promise<ScheduleDay> {
    let q = this.sb.from("schedule_days").select("*").eq("date", date);
    q = memberId ? q.eq("member_id", memberId) : q.is("member_id", null);
    const { data: existing } = await q.maybeSingle();

    const record: ScheduleDay = {
      id: existing ? String(existing.id) : uid("sd"),
      date,
      memberId,
      dayType,
      decidedById: actorId,
      note,
    };
    const { error } = await this.sb.from("schedule_days").upsert(toRow(record));
    if (error) throw new Error(error.message);

    await this.audit(actorId, record.id, "day_decided", "", dayType, "schedule");
    return record;
  }

  /* ---------------------------------------------------------------- *
   * Stats
   * ---------------------------------------------------------------- */

  async memberStats(memberId: string, range: DateRange): Promise<MemberStats> {
    const [interactions, attendance, allTasks, owned] = await Promise.all([
      this.listInteractions({ memberId, range }),
      this.attendanceFor(memberId, range),
      this.listTasks({ assigneeId: memberId }),
      this.listClients({ ownerId: memberId }),
    ]);

    const tasksInRange = allTasks.filter((t) => t.dueAt && inRange(t.dueAt, range));
    const touched = new Set(interactions.map((i) => i.clientId));

    const stageAdvances = interactions.filter(
      (i) => i.stageBefore && i.stageAfter && isAdvance(i.stageBefore, i.stageAfter),
    ).length;
    const proposalsSent = interactions.filter((i) => i.type === "proposal_sent").length;

    const efficiency = computeEfficiency({
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
      newClients: owned.filter((c) => inRange(c.createdAt, range)).length,
      interactions: interactions.length,
      visits: interactions.filter((i) => i.type === "visit").length,
      meetings: interactions.filter((i) => i.type === "meeting").length,
      calls: interactions.filter((i) => i.type === "call").length,
      proposalsSent,
      stageAdvances,
      won: owned.filter((c) => c.status === "won" && inRange(c.updatedAt, range)).length,
      lost: owned.filter((c) => c.status === "lost_retryable").length,
      dead: owned.filter((c) => c.status === "dead").length,
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
    raw: { includeDone?: boolean } | null = {},
  ): Promise<Reminder[]> {
    const opts = raw ?? {};
    const { data, error } = await this.sb
      .from("reminders")
      .select("*")
      .order("due_date");
    if (error) throw new Error(error.message);

    return fromRows<Reminder>(data).filter(
      (r) =>
        (r.memberId === memberId || (r.sharedWith ?? []).includes(memberId)) &&
        (opts.includeDone ? true : !r.done),
    );
  }

  async createReminder(
    input: Omit<Reminder, "id" | "createdAt" | "done" | "completedAt" | "snoozedUntil">,
  ): Promise<Reminder> {
    const reminder: Reminder = {
      ...input,
      id: uid("rem"),
      done: false,
      completedAt: null,
      snoozedUntil: null,
      createdAt: isoNow(),
    };
    const { error } = await this.sb.from("reminders").insert(toRow(reminder));
    if (error) throw new Error(error.message);
    return reminder;
  }

  async updateReminder(id: string, patch: Partial<Reminder>): Promise<Reminder> {
    const { data, error } = await this.sb
      .from("reminders")
      .update(toRow(patch))
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return fromRow<Reminder>(data);
  }

  async completeReminder(id: string, done: boolean): Promise<Reminder> {
    return this.updateReminder(id, { done, completedAt: done ? isoNow() : null });
  }

  async snoozeReminder(id: string, untilDate: string): Promise<Reminder> {
    return this.updateReminder(id, { snoozedUntil: untilDate });
  }

  async deleteReminder(id: string): Promise<void> {
    await this.sb.from("reminders").delete().eq("id", id);
  }

  async refreshAutoReminders(memberId: string): Promise<Reminder[]> {
    const [clients, existing] = await Promise.all([
      this.listClients({ ownerId: memberId }),
      this.listReminders(memberId, { includeDone: true }),
    ]);
    const today = toDateKey(new Date());
    const created: Reminder[] = [];

    for (const client of clients) {
      if (client.ownerId !== memberId) continue;
      if (client.status !== "active" || !client.isStale) continue;
      if (existing.some((r) => r.auto && r.clientId === client.id && !r.done)) continue;

      created.push(
        await this.createReminder({
          memberId,
          title: `${client.name} has gone quiet`,
          note: `No contact for ${client.daysSinceContact} days. ${
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
    raw: { from?: string } | null = {},
  ): Promise<DayRoute[]> {
    const opts = raw ?? {};
    let q = this.sb.from("routes").select("*").eq("member_id", memberId);
    if (opts.from) q = q.gte("date", opts.from);
    const { data, error } = await q.order("date");
    if (error) throw new Error(error.message);
    return fromRows<DayRoute>(data);
  }

  async getRoute(id: string): Promise<DayRoute | null> {
    const { data } = await this.sb.from("routes").select("*").eq("id", id).maybeSingle();
    return data ? fromRow<DayRoute>(data) : null;
  }

  async createRoute(memberId: string, date: string, title: string): Promise<DayRoute> {
    const route: DayRoute = {
      id: uid("rt"),
      memberId,
      date,
      title,
      stops: [],
      createdAt: isoNow(),
    };
    const { error } = await this.sb.from("routes").insert(toRow(route));
    if (error) throw new Error(error.message);
    return route;
  }

  async updateRoute(id: string, patch: Partial<DayRoute>): Promise<DayRoute> {
    const { data, error } = await this.sb
      .from("routes")
      .update(toRow(patch))
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return fromRow<DayRoute>(data);
  }

  async deleteRoute(id: string): Promise<void> {
    await this.sb.from("routes").delete().eq("id", id);
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

  private async allMessages(): Promise<Message[]> {
    const { data, error } = await this.sb.from("messages").select("*").order("sent_at");
    if (error) throw new Error(error.message);
    return fromRows<Message>(data).map((m) => ({ ...m, readBy: m.readBy ?? [] }));
  }

  async listThreads(memberId: string): Promise<ThreadSummary[]> {
    const all = await this.allMessages();
    const partners: (string | null)[] = [
      null,
      ...MEMBERS.filter((m) => m.id !== memberId).map((m) => m.id),
    ];

    return partners.map((withId) => {
      const msgs = all.filter((msg) => this.inThread(msg, memberId, withId));
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
    const all = await this.allMessages();
    return all.filter((msg) => this.inThread(msg, memberId, withId));
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
    const { error } = await this.sb.from("messages").insert(toRow(message));
    if (error) throw new Error(error.message);
    return message;
  }

  async markThreadRead(memberId: string, withId: string | null): Promise<void> {
    const all = await this.allMessages();
    const unread = all.filter(
      (msg) => this.inThread(msg, memberId, withId) && !msg.readBy.includes(memberId),
    );
    await Promise.all(
      unread.map((msg) =>
        this.sb
          .from("messages")
          .update({ read_by: [...msg.readBy, memberId] })
          .eq("id", msg.id),
      ),
    );
  }

  /* ---------------------------------------------------------------- *
   * Profile
   * ---------------------------------------------------------------- */

  async getProfile(memberId: string): Promise<MemberProfile> {
    const { data } = await this.sb
      .from("member_profiles")
      .select("*")
      .eq("member_id", memberId)
      .maybeSingle();

    if (data) return fromRow<MemberProfile>(data);

    const member = MEMBERS.find((m) => m.id === memberId);
    return {
      memberId,
      photo: "",
      plannedStart: member?.plannedStart ?? DEFAULT_START,
      plannedEnd: member?.plannedEnd ?? DEFAULT_END,
      phone: "",
      updatedAt: isoNow(),
    };
  }

  async updateProfile(
    memberId: string,
    patch: Partial<MemberProfile>,
  ): Promise<MemberProfile> {
    const current = await this.getProfile(memberId);
    const next = { ...current, ...patch, memberId, updatedAt: isoNow() };
    const { error } = await this.sb
      .from("member_profiles")
      .upsert(toRow(next), { onConflict: "member_id" });
    if (error) throw new Error(error.message);
    return next;
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
          stage: row.stage,
          status: row.status,
          ownerId,
          broughtById: ownerId,
          source: "Bulk import",
          whatHappened: row.whatHappened.trim(),
          closedReason: row.closedReason.trim(),
          dealValueSar: row.dealValueSar,
          contact:
            row.contactName.trim() || row.contactPhone.trim()
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
    return { created, joined, skipped };
  }

  async importActivity(
    rows: ParsedActivityRow[],
    memberId: string,
  ): Promise<{ created: number }> {
    let created = 0;
    for (const row of rows) {
      if (!row.include || !row.clientId || !row.summary.trim()) continue;
      await this.logInteraction({
        clientId: row.clientId,
        memberId,
        type: row.type,
        summary: row.summary.trim(),
        happenedAt: new Date(`${row.date}T12:00:00`).toISOString(),
      });
      created++;
    }
    return { created };
  }

  /* ---------------------------------------------------------------- *
   * Audit + housekeeping
   * ---------------------------------------------------------------- */

  async listAudit(entityId?: string | null): Promise<AuditEntry[]> {
    let q = this.sb.from("audit_log").select("*");
    if (entityId) q = q.eq("entity_id", entityId);
    const { data, error } = await q.order("at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return fromRows<AuditEntry>(data);
  }

  /** Not offered against a shared database — wiping everyone's data from a
   *  settings screen is not a button that should exist. */
  async resetToSeed(): Promise<void> {
    throw new Error(
      "Resetting is only available in local mode. The shared database is not wiped from the app.",
    );
  }

  async exportAll(): Promise<string> {
    const tables = [
      "clients",
      "contacts",
      "interactions",
      "tasks",
      "attendance",
      "schedule_days",
      "reminders",
      "messages",
      "routes",
      "audit_log",
    ];
    const out: Record<string, unknown> = { exportedAt: isoNow() };
    for (const table of tables) {
      const { data } = await this.sb.from(table).select("*");
      out[table] = data ?? [];
    }
    return JSON.stringify(out, null, 2);
  }

  /**
   * Moves a member's local data into the shared database.
   *
   * Used once, when each person switches over: whatever they built up on
   * their own phone is pushed up rather than lost. Ids are preserved, so
   * running it twice does not duplicate anything.
   */
  async importAll(json: string): Promise<void> {
    const parsed = JSON.parse(json) as Record<string, unknown[]>;
    const order: [string, string][] = [
      ["clients", "clients"],
      ["contacts", "contacts"],
      ["interactions", "interactions"],
      ["tasks", "tasks"],
      ["attendance", "attendance"],
      ["schedule", "schedule_days"],
      ["reminders", "reminders"],
      ["messages", "messages"],
      ["routes", "routes"],
      ["audit", "audit_log"],
    ];

    for (const [key, table] of order) {
      const rows = parsed[key];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      const mapped = rows.map((r) => toRow(r as object));
      const { error } = await this.sb.from(table).upsert(mapped, { onConflict: "id" });
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  }

  /** Used by the setup check to confirm the schema is actually there. */
  async healthCheck(): Promise<{ ok: boolean; detail: string }> {
    const { error, count } = await this.sb
      .from("members")
      .select("*", { count: "exact", head: true });
    if (error) return { ok: false, detail: error.message };
    return { ok: true, detail: `${count ?? 0} members` };
  }
}

export { addDays };
