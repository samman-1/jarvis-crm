"use client";

import Link from "next/link";
import { addDays, addMonths, endOfMonth, startOfMonth } from "date-fns";
import { useMemo, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSession } from "@/components/providers/session-provider";
import { useAsync, useMounted } from "@/lib/hooks/use-async";
import { db } from "@/lib/data";
import { Button, Card, CardHeader, Skeleton } from "@/components/ui/primitives";
import { InteractionIcon, InteractionLabel, MemberBadge } from "@/components/ui/badges";
import { PUBLIC_MEMBERS } from "@/lib/config/members";
import { WEEK, dayRule } from "@/lib/config/schedule";
import type { Attendance, Interaction } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";
import { formatTime, toDateKey } from "@/lib/dates";
import { cn, formatMinutes } from "@/lib/utils";

type Scope = "mine" | "everyone";

/**
 * The month, seen as work rather than as a schedule.
 *
 * Every visit, call and message sits on the day it happened, so "what did I do
 * on Sunday" is one tap. Switching to Everyone puts all three members on the
 * same grid — the answer to "where has the team actually been this month".
 */
export function DayCalendar({ locale }: { locale: Locale }) {
  const { m } = useI18n();
  const { user } = useSession();
  const mounted = useMounted();

  const [scope, setScope] = useState<Scope>("mine");
  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState<string>(toDateKey(new Date()));

  const month = useMemo(() => addMonths(new Date(), monthOffset), [monthOffset]);

  const range = useMemo(
    () => ({
      key: "month" as const,
      from: startOfMonth(month).toISOString(),
      to: endOfMonth(month).toISOString(),
      label: "",
    }),
    [month],
  );

  const interactions = useAsync(
    () =>
      mounted
        ? db().listInteractions(
            scope === "mine" ? { memberId: user.id, range } : { range },
          )
        : Promise.resolve([] as Interaction[]),
    [mounted, scope, user.id, range.from],
  );

  const attendance = useAsync(
    () =>
      mounted
        ? Promise.all(
            (scope === "mine"
              ? PUBLIC_MEMBERS.filter((p) => p.id === user.id)
              : PUBLIC_MEMBERS
            ).map((p) => db().attendanceFor(p.id, range)),
          ).then((all) => all.flat())
        : Promise.resolve([] as Attendance[]),
    [mounted, scope, user.id, range.from],
  );

  const clients = useAsync(
    () => (mounted ? db().listClients() : Promise.resolve([])),
    [mounted],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Interaction[]>();
    for (const i of interactions.data ?? []) {
      const key = toDateKey(i.happenedAt);
      const list = map.get(key) ?? [];
      list.push(i);
      map.set(key, list);
    }
    return map;
  }, [interactions.data]);

  const hoursByDay = useMemo(() => {
    const map = new Map<string, Attendance[]>();
    for (const a of attendance.data ?? []) {
      const list = map.get(a.date) ?? [];
      list.push(a);
      map.set(a.date, list);
    }
    return map;
  }, [attendance.data]);

  const cells = useMemo(() => {
    const first = startOfMonth(month);
    const start = addDays(first, -first.getDay());
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);

  const clientName = (id: string) => {
    const c = (clients.data ?? []).find((x) => x.id === id);
    if (!c) return "";
    return locale === "ar" && c.nameAr ? c.nameAr : c.name;
  };

  const todayKey = toDateKey(new Date());
  const selectedItems = (byDay.get(selected) ?? []).sort((a, b) =>
    a.happenedAt.localeCompare(b.happenedAt),
  );
  const selectedHours = hoursByDay.get(selected) ?? [];

  const monthLabel = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    month: "long",
    year: "numeric",
  }).format(month);

  return (
    <div className="space-y-4">
      {/* --- Mine / Everyone + month ---------------------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 overflow-hidden rounded-md border border-border">
          {(["mine", "everyone"] as Scope[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={cn(
                "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
                scope === s ? "bg-accent-soft text-accent" : "text-muted hover:text-fg",
              )}
            >
              {s === "mine" ? m.calendar.whatIDid : m.calendar.whatWeAllDid}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="quiet" onClick={() => setMonthOffset((v) => v - 1)}>
            <span className="rtl:rotate-180">←</span>
          </Button>
          <span className="min-w-28 text-center text-sm font-medium">{monthLabel}</span>
          <Button size="sm" variant="quiet" onClick={() => setMonthOffset((v) => v + 1)}>
            <span className="rtl:rotate-180">→</span>
          </Button>
        </div>
      </div>

      {/* --- Grid ------------------------------------------------------ */}
      <Card padded={false} className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border">
          {WEEK.map((d) => (
            <div
              key={d.key}
              className={cn(
                "px-1 py-2 text-center text-[10px] font-medium tracking-wide uppercase",
                d.type === "off" ? "text-faint" : "text-muted",
              )}
            >
              {locale === "ar" ? d.shortAr : d.short}
            </div>
          ))}
        </div>

        {!mounted || interactions.loading ? (
          <Skeleton className="h-80 rounded-none" />
        ) : (
          <div className="grid grid-cols-7">
            {cells.map((date) => {
              const key = toDateKey(date);
              const inMonth = date.getMonth() === month.getMonth();
              const items = byDay.get(key) ?? [];
              const hours = hoursByDay.get(key) ?? [];
              const worked = hours.reduce((s, a) => s + a.minutesWorked, 0);
              const isToday = key === todayKey;
              const isSelected = key === selected;
              const rule = dayRule(date.getDay());

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(key)}
                  className={cn(
                    "min-h-16 border-b border-e border-border p-1 text-start transition-colors sm:min-h-20 sm:p-1.5",
                    !inMonth && "opacity-30",
                    rule.type === "off" && "bg-bg-elev",
                    isSelected && "bg-accent-soft ring-1 ring-accent ring-inset",
                    !isSelected && "hover:bg-surface-2",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "tnum text-[11px] font-medium",
                        isToday ? "text-accent" : "text-muted",
                      )}
                    >
                      {date.getDate()}
                    </span>
                    {worked > 0 ? (
                      <span className="tnum text-[9px] text-faint">
                        {Math.round(worked / 60)}h
                      </span>
                    ) : null}
                  </div>

                  {items.length ? (
                    <div className="mt-1 space-y-0.5">
                      {/* A dot per member keeps the cell readable at phone size;
                          the count carries the volume. */}
                      <div className="flex flex-wrap gap-0.5">
                        {[...new Set(items.map((i) => i.memberId))].map((id) => {
                          const p = PUBLIC_MEMBERS.find((x) => x.id === id);
                          return (
                            <span
                              key={id}
                              className="size-1.5 rounded-full"
                              style={{ backgroundColor: p?.color ?? "var(--muted)" }}
                            />
                          );
                        })}
                      </div>
                      <div
                        className="tnum rounded-sm px-1 text-[10px] font-medium"
                        style={{
                          backgroundColor: "var(--accent-soft)",
                          color: "var(--accent)",
                        }}
                      >
                        {items.length}
                      </div>
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* --- The selected day ------------------------------------------ */}
      <Card>
        <CardHeader
          title={new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
          }).format(new Date(`${selected}T12:00:00`))}
          hint={
            selectedItems.length
              ? `${selectedItems.length} ${m.calendar.thingsLogged}`
              : m.calendar.nothingThatDay
          }
        />

        {selectedHours.length ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {selectedHours.map((a) => {
              const p = PUBLIC_MEMBERS.find((x) => x.id === a.memberId);
              if (!a.checkInAt) return null;
              return (
                <span
                  key={a.id}
                  className="tnum inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs"
                >
                  <MemberBadge memberId={a.memberId} size="xs" />
                  {formatTime(a.checkInAt)}
                  {a.checkOutAt ? ` → ${formatTime(a.checkOutAt)}` : ""}
                  <span className="text-faint">{formatMinutes(a.minutesWorked)}</span>
                  {p && a.reason ? (
                    <span className="text-faint">· {a.reason}</span>
                  ) : null}
                </span>
              );
            })}
          </div>
        ) : null}

        {selectedItems.length === 0 ? (
          <p className="text-xs text-faint">{m.calendar.nothingThatDay}</p>
        ) : (
          <ol className="space-y-3">
            {selectedItems.map((i) => (
              <li key={i.id} className="flex items-start gap-3">
                <InteractionIcon type={i.type} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-medium">
                      <InteractionLabel type={i.type} />
                    </span>
                    {scope === "everyone" ? (
                      <MemberBadge memberId={i.memberId} size="xs" />
                    ) : null}
                    <span className="tnum text-xs text-faint">
                      {formatTime(i.happenedAt)}
                    </span>
                  </div>
                  <Link
                    href={`/${locale}/clients/${i.clientId}`}
                    className="text-sm font-medium text-accent underline-offset-2 hover:underline"
                  >
                    {clientName(i.clientId)}
                  </Link>
                  <p className="text-sm leading-relaxed text-muted">{i.summary}</p>
                  {i.outcome ? (
                    <p className="text-xs text-faint">{i.outcome}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
