"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSession } from "@/components/providers/session-provider";
import { db } from "@/lib/data";
import { Button, Card, CardHeader, Input, Select } from "@/components/ui/primitives";
import type { ClientRow, Priority, Task } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";
import { relativeDays } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Tasks you can actually create, tick off, reopen and delete.
 *
 * Used on the dashboard for everything assigned to you, and on a client page
 * scoped to that client (where `fixedClientId` removes the picker).
 */
export function TaskPanel({
  tasks,
  clients,
  locale,
  onChanged,
  fixedClientId,
  title,
}: {
  tasks: Task[];
  clients: ClientRow[];
  locale: Locale;
  onChanged: () => void;
  fixedClientId?: string;
  title?: string;
}) {
  const { m } = useI18n();
  const { user } = useSession();

  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [clientId, setClientId] = useState(fixedClientId ?? "");
  const [priority, setPriority] = useState<Priority>("normal");
  const [busy, setBusy] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const open = tasks.filter((t) => t.status === "open");
  const done = tasks.filter((t) => t.status === "done");
  const now = Date.now();
  const overdue = open.filter((t) => t.dueAt && new Date(t.dueAt).getTime() < now);
  const upcoming = open.filter(
    (t) => !t.dueAt || new Date(t.dueAt).getTime() >= now,
  );

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await db().createTask({
        title: text.trim(),
        clientId: clientId || null,
        assigneeId: user.id,
        dueAt: due ? new Date(`${due}T12:00:00`).toISOString() : null,
        status: "open",
        priority,
      });
      setText("");
      setDue("");
      setPriority("normal");
      if (!fixedClientId) setClientId("");
      setAdding(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function toggle(task: Task) {
    await db().toggleTask(task.id, task.status !== "done");
    onChanged();
  }

  async function remove(task: Task) {
    if (!window.confirm(m.actions.removeConfirm)) return;
    await db().deleteTask(task.id);
    onChanged();
  }

  return (
    <Card>
      <CardHeader
        title={title ?? m.client.tasks}
        hint={`${open.length} ${m.dashboard.upcoming.toLowerCase()}`}
        action={
          <Button
            size="sm"
            variant={adding ? "ghost" : "secondary"}
            onClick={() => setAdding((v) => !v)}
          >
            {adding ? m.common.cancel : `+ ${m.actions.addTask}`}
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
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={m.actions.taskPlaceholder}
            className="h-11"
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              aria-label={m.actions.dueDate}
              className="h-11"
              dir="ltr"
            />
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              aria-label={m.actions.priority}
              className="h-11"
            >
              <option value="low">{m.actions.low}</option>
              <option value="normal">{m.actions.normal}</option>
              <option value="high">{m.actions.high}</option>
            </Select>
          </div>

          {!fixedClientId ? (
            <Select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              aria-label={m.actions.forClient}
              className="h-11"
            >
              <option value="">{m.actions.noClient}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {locale === "ar" && c.nameAr ? c.nameAr : c.name}
                </option>
              ))}
            </Select>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={busy || !text.trim()}
          >
            {busy ? m.common.saving : m.actions.save}
          </Button>
        </form>
      ) : null}

      {open.length === 0 && done.length === 0 ? (
        <p className="text-xs text-faint">{m.dashboard.noTasks}</p>
      ) : (
        <div className="space-y-4">
          {overdue.length ? (
            <Group
              label={m.dashboard.overdue}
              tone="var(--critical)"
              tasks={overdue}
              locale={locale}
              onToggle={toggle}
              onDelete={remove}
              m={m}
            />
          ) : null}
          {upcoming.length ? (
            <Group
              label={m.dashboard.upcoming}
              tone="var(--muted)"
              tasks={upcoming}
              locale={locale}
              onToggle={toggle}
              onDelete={remove}
              m={m}
            />
          ) : null}

          {done.length ? (
            <div>
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                className="text-[11px] font-semibold tracking-wide text-faint uppercase transition-colors hover:text-fg"
              >
                {showDone ? m.actions.hideCompleted : m.actions.showCompleted} ·{" "}
                {done.length}
              </button>
              {showDone ? (
                <div className="mt-2">
                  <Group
                    label=""
                    tone="var(--faint)"
                    tasks={done}
                    locale={locale}
                    onToggle={toggle}
                    onDelete={remove}
                    m={m}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}

function Group({
  label,
  tone,
  tasks,
  locale,
  onToggle,
  onDelete,
  m,
}: {
  label: string;
  tone: string;
  tasks: Task[];
  locale: Locale;
  onToggle: (t: Task) => void;
  onDelete: (t: Task) => void;
  m: ReturnType<typeof useI18n>["m"];
}) {
  return (
    <div>
      {label ? (
        <div
          className="mb-2 text-[11px] font-semibold tracking-wide uppercase"
          style={{ color: tone }}
        >
          {label} · {tasks.length}
        </div>
      ) : null}

      <ul className="space-y-1">
        {tasks.map((t) => {
          const isDone = t.status === "done";
          return (
            <li
              key={t.id}
              className="group flex items-start gap-2.5 rounded-md px-1 py-1.5 transition-colors hover:bg-surface-2"
            >
              {/* Big enough to hit with a thumb without zooming. */}
              <button
                type="button"
                onClick={() => onToggle(t)}
                aria-label={isDone ? m.actions.reopen : m.actions.done}
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm border transition-colors",
                  isDone
                    ? "border-success bg-success text-white"
                    : "border-border-strong hover:border-accent hover:bg-accent-soft",
                )}
              >
                {isDone ? "✓" : ""}
              </button>

              <div className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-sm",
                    isDone && "text-faint line-through",
                  )}
                >
                  {t.title}
                </span>
                <span className="flex flex-wrap items-center gap-x-2 text-[11px] text-faint">
                  {t.dueAt ? <span>{relativeDays(t.dueAt, locale)}</span> : null}
                  {t.priority === "high" ? (
                    <span className="text-warn">{m.actions.high}</span>
                  ) : null}
                  {t.clientId ? (
                    <Link
                      href={`/${locale}/clients/${t.clientId}`}
                      className="underline-offset-2 hover:text-accent hover:underline"
                    >
                      {m.common.open} →
                    </Link>
                  ) : null}
                </span>
              </div>

              <button
                type="button"
                onClick={() => onDelete(t)}
                aria-label={m.actions.remove}
                title={m.actions.remove}
                className="shrink-0 px-1 text-xs text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-critical focus-visible:opacity-100"
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
