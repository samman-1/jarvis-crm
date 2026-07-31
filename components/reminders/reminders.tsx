"use client";

import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import { useMemo, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSession } from "@/components/providers/session-provider";
import { useAsync, useMounted } from "@/lib/hooks/use-async";
import { db } from "@/lib/data";
import {
  Button,
  Card,
  CardHeader,
  Input,
  Select,
  Skeleton,
  Textarea,
} from "@/components/ui/primitives";
import { PUBLIC_MEMBERS } from "@/lib/config/members";
import type { ClientRow, Reminder, ReminderUrgency } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";
import { fromDateKey, toDateKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** How loudly a reminder should shout, based on how close its date is. */
export function urgencyOf(r: Reminder, today = new Date()): ReminderUrgency {
  const days = differenceInCalendarDays(fromDateKey(r.dueDate), today);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= r.warnDaysBefore) return "soon";
  return "later";
}

const URGENCY_COLOR: Record<ReminderUrgency, string> = {
  overdue: "var(--critical)",
  today: "var(--accent)",
  soon: "var(--warn)",
  later: "var(--muted)",
};

/** True when this reminder should appear in the login banner right now. */
function isLive(r: Reminder, today = new Date()): boolean {
  if (r.done) return false;
  if (r.snoozedUntil && r.snoozedUntil >= toDateKey(today)) return false;
  return urgencyOf(r, today) !== "later";
}

/* ------------------------------------------------------------------ *
 * The banner that greets you
 * ------------------------------------------------------------------ */

/**
 * Sits at the top of the dashboard whenever something is due or nearly due.
 *
 * The point of a reminder is to interrupt you, so this is not tucked away on
 * its own page — it is the first thing on the screen you land on, and it stays
 * until you tick it off or snooze it to tomorrow.
 */
export function ReminderBanner({ locale }: { locale: Locale }) {
  const { m } = useI18n();
  const { user } = useSession();
  const mounted = useMounted();

  const { data, loading, reload } = useAsync(async () => {
    if (!mounted) return [] as Reminder[];
    // Stale clients become reminders by themselves, checked on arrival.
    await db().refreshAutoReminders(user.id);
    return db().listReminders(user.id);
  }, [mounted, user.id]);

  const live = useMemo(
    () => (data ?? []).filter((r) => isLive(r)).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [data],
  );

  if (!mounted || loading || live.length === 0) return null;

  return (
    <div className="animate-enter space-y-2">
      {live.map((r) => {
        const urgency = urgencyOf(r);
        const color = URGENCY_COLOR[urgency];
        const days = differenceInCalendarDays(fromDateKey(r.dueDate), new Date());

        return (
          <div
            key={r.id}
            className="flex flex-wrap items-start gap-3 rounded-lg border p-3.5"
            style={{ borderColor: color, backgroundColor: `${color}14` }}
            role="status"
          >
            <span className="mt-0.5 text-base" aria-hidden>
              {urgency === "overdue" ? "🔴" : urgency === "today" ? "🔔" : "⏳"}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-semibold">{r.title}</span>
                <span className="text-xs font-medium" style={{ color }}>
                  {urgency === "overdue"
                    ? `${m.reminders.overdueBy} ${Math.abs(days)} ${m.common.days}`
                    : urgency === "today"
                      ? m.reminders.dueToday
                      : `${m.reminders.inDays} ${days} ${m.common.days}`}
                </span>
              </div>
              {r.note ? (
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{r.note}</p>
              ) : null}
              {r.clientId ? (
                <Link
                  href={`/${locale}/clients/${r.clientId}`}
                  className="mt-1 inline-block text-xs underline-offset-2 hover:underline"
                  style={{ color }}
                >
                  {m.common.open} →
                </Link>
              ) : null}
            </div>

            <div className="flex shrink-0 gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  await db().completeReminder(r.id, true);
                  reload();
                }}
              >
                {m.actions.done}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  await db().snoozeReminder(r.id, toDateKey(tomorrow));
                  reload();
                }}
              >
                {m.reminders.snooze}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The full list
 * ------------------------------------------------------------------ */

export function RemindersPanel({
  locale,
  clients,
}: {
  locale: Locale;
  clients: ClientRow[];
}) {
  const { m } = useI18n();
  const { user } = useSession();
  const mounted = useMounted();

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [dueDate, setDueDate] = useState(toDateKey(new Date()));
  const [warnDaysBefore, setWarnDaysBefore] = useState(2);
  const [clientId, setClientId] = useState("");
  const [shareWith, setShareWith] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const { data, loading, reload } = useAsync(
    () =>
      mounted
        ? db().listReminders(user.id, { includeDone: true })
        : Promise.resolve([] as Reminder[]),
    [mounted, user.id],
  );

  const all = data ?? [];
  const open = all.filter((r) => !r.done);
  const done = all.filter((r) => r.done);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await db().createReminder({
        memberId: user.id,
        title: title.trim(),
        note: note.trim(),
        dueDate,
        warnDaysBefore,
        clientId: clientId || null,
        sharedWith: shareWith,
        auto: false,
      });
      setTitle("");
      setNote("");
      setClientId("");
      setShareWith([]);
      setAdding(false);
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title={m.reminders.title}
        hint={m.reminders.hint}
        action={
          <Button
            size="sm"
            variant={adding ? "ghost" : "primary"}
            onClick={() => setAdding((v) => !v)}
          >
            {adding ? m.common.cancel : `+ ${m.reminders.add}`}
          </Button>
        }
      />

      {adding ? (
        <form
          onSubmit={create}
          className="animate-enter mb-4 space-y-2.5 rounded-md border border-accent/40 bg-accent-softer p-3"
        >
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={m.reminders.placeholder}
            className="h-11"
          />
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={m.reminders.notePlaceholder}
            className="min-h-16"
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted">
                {m.reminders.dueOn}
              </span>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-11"
                dir="ltr"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted">
                {m.reminders.warnMe}
              </span>
              <Select
                value={String(warnDaysBefore)}
                onChange={(e) => setWarnDaysBefore(Number(e.target.value))}
                className="h-11"
              >
                <option value="0">{m.reminders.warnOnDay}</option>
                <option value="1">1 {m.reminders.dayBefore}</option>
                <option value="2">2 {m.reminders.daysBefore}</option>
                <option value="3">3 {m.reminders.daysBefore}</option>
                <option value="7">7 {m.reminders.daysBefore}</option>
              </Select>
            </label>
          </div>

          {clients.length ? (
            <Select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="h-11"
              aria-label={m.actions.forClient}
            >
              <option value="">{m.actions.noClient}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {locale === "ar" && c.nameAr ? c.nameAr : c.name}
                </option>
              ))}
            </Select>
          ) : null}

          <div>
            <span className="mb-1.5 block text-[11px] text-muted">
              {m.reminders.shareWith}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PUBLIC_MEMBERS.filter((p) => p.id !== user.id).map((p) => {
                const on = shareWith.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      setShareWith((s) =>
                        on ? s.filter((x) => x !== p.id) : [...s, p.id],
                      )
                    }
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      on ? "border-transparent" : "border-border text-muted",
                    )}
                    style={
                      on
                        ? { backgroundColor: `${p.color}1f`, color: p.color }
                        : undefined
                    }
                  >
                    {locale === "ar" ? p.nameAr : p.name}
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={busy || !title.trim()}
          >
            {busy ? m.common.saving : m.common.save}
          </Button>
        </form>
      ) : null}

      {loading ? (
        <Skeleton className="h-24" />
      ) : open.length === 0 && done.length === 0 ? (
        <p className="text-xs text-faint">{m.reminders.empty}</p>
      ) : (
        <div className="space-y-3">
          {open.map((r) => (
            <Row key={r.id} reminder={r} locale={locale} onChanged={reload} m={m} />
          ))}

          {done.length ? (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                className="text-[11px] font-semibold tracking-wide text-faint uppercase transition-colors hover:text-fg"
              >
                {showDone ? m.actions.hideCompleted : m.actions.showCompleted} ·{" "}
                {done.length}
              </button>
              {showDone ? (
                <div className="mt-2 space-y-2">
                  {done.map((r) => (
                    <Row
                      key={r.id}
                      reminder={r}
                      locale={locale}
                      onChanged={reload}
                      m={m}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}

function Row({
  reminder,
  locale,
  onChanged,
  m,
}: {
  reminder: Reminder;
  locale: Locale;
  onChanged: () => void;
  m: ReturnType<typeof useI18n>["m"];
}) {
  const urgency = urgencyOf(reminder);
  const color = reminder.done ? "var(--faint)" : URGENCY_COLOR[urgency];

  return (
    <div className="group flex items-start gap-2.5 rounded-md border border-border bg-surface-2 p-3">
      <button
        type="button"
        onClick={async () => {
          await db().completeReminder(reminder.id, !reminder.done);
          onChanged();
        }}
        aria-label={reminder.done ? m.actions.reopen : m.actions.done}
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm border text-xs transition-colors",
          reminder.done
            ? "border-success bg-success text-white"
            : "border-border-strong hover:border-accent hover:bg-accent-soft",
        )}
      >
        {reminder.done ? "✓" : ""}
      </button>

      <div className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-sm font-medium",
            reminder.done && "text-faint line-through",
          )}
        >
          {reminder.title}
          {reminder.auto ? (
            <span className="ms-2 rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] font-normal text-faint">
              {m.reminders.automatic}
            </span>
          ) : null}
        </span>
        {reminder.note ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{reminder.note}</p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px]">
          <span style={{ color }}>{reminder.dueDate}</span>
          {reminder.sharedWith.length ? (
            <span className="text-faint">
              {m.reminders.sharedWith}{" "}
              {reminder.sharedWith
                .map((id) => {
                  const p = PUBLIC_MEMBERS.find((x) => x.id === id);
                  return p ? (locale === "ar" ? p.nameAr : p.name) : "";
                })
                .filter(Boolean)
                .join(", ")}
            </span>
          ) : null}
          {reminder.clientId ? (
            <Link
              href={`/${locale}/clients/${reminder.clientId}`}
              className="text-faint underline-offset-2 hover:text-accent hover:underline"
            >
              {m.common.open} →
            </Link>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={async () => {
          if (!window.confirm(m.actions.removeConfirm)) return;
          await db().deleteReminder(reminder.id);
          onChanged();
        }}
        aria-label={m.actions.remove}
        className="shrink-0 px-1 text-xs text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-critical focus-visible:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}
