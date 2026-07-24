"use client";

import { addDays, addMonths, endOfMonth, startOfMonth } from "date-fns";
import { useMemo, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSession } from "@/components/providers/session-provider";
import { useAsync, useMounted } from "@/lib/hooks/use-async";
import { db } from "@/lib/data";
import {
  Button,
  Card,
  CardHeader,
  Ring,
  Skeleton,
} from "@/components/ui/primitives";
import { MemberBadge } from "@/components/ui/badges";
import { PageHeader } from "@/components/shell/page-header";
import { PUBLIC_MEMBERS } from "@/lib/config/members";
import {
  CONDITIONAL_DAYS,
  DEFAULT_END,
  DEFAULT_START,
  REVIEW_MEETING,
  WEEK,
  dayRule,
} from "@/lib/config/schedule";
import { scoreBand, wedThuRecommendation } from "@/lib/efficiency";
import { formatTime, rangeFor, startOfWorkWeek, toDateKey } from "@/lib/dates";
import type { Attendance, ScheduleDay } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

const ATTENDANCE_COLOR: Record<Attendance["status"], string> = {
  present: "var(--success)",
  late: "var(--warn)",
  left_early: "var(--warn)",
  absent: "var(--critical)",
  off: "var(--faint)",
  approved_off: "var(--faint)",
};

export function CalendarView({ locale }: { locale: Locale }) {
  const { m } = useI18n();
  const { user } = useSession();
  const mounted = useMounted();

  const [monthOffset, setMonthOffset] = useState(0);

  const month = useMemo(
    () => addMonths(new Date(), monthOffset),
    [monthOffset],
  );

  const monthRange = useMemo(
    () => ({
      key: "month" as const,
      from: startOfMonth(month).toISOString(),
      to: endOfMonth(month).toISOString(),
      label: "",
    }),
    [month],
  );

  const weekRange = useMemo(() => rangeFor("week"), []);

  const attendance = useAsync(
    () =>
      mounted
        ? Promise.all(
            PUBLIC_MEMBERS.map((p) => db().attendanceFor(p.id, monthRange)),
          ).then((all) => all.flat())
        : Promise.resolve([] as Attendance[]),
    [mounted, monthRange.from],
  );

  const schedule = useAsync(
    () =>
      mounted ? db().listScheduleDays(monthRange) : Promise.resolve([] as ScheduleDay[]),
    [mounted, monthRange.from],
  );

  const teamStats = useAsync(
    () => (mounted ? db().teamStats(weekRange) : Promise.resolve([])),
    [mounted, weekRange.from],
  );

  /* Six weeks of cells, always starting on a Sunday. */
  const cells = useMemo(() => {
    const first = startOfMonth(month);
    const start = addDays(first, -first.getDay());
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);

  const attendanceByKey = useMemo(() => {
    const map = new Map<string, Attendance[]>();
    for (const a of attendance.data ?? []) {
      const list = map.get(a.date) ?? [];
      list.push(a);
      map.set(a.date, list);
    }
    return map;
  }, [attendance.data]);

  const scheduleByKey = useMemo(() => {
    const map = new Map<string, ScheduleDay[]>();
    for (const s of schedule.data ?? []) {
      const list = map.get(s.date) ?? [];
      list.push(s);
      map.set(s.date, list);
    }
    return map;
  }, [schedule.data]);

  const todayKey = toDateKey(new Date());
  const monthLabel = new Intl.DateTimeFormat(
    locale === "ar" ? "ar-SA" : "en-GB",
    { month: "long", year: "numeric" },
  ).format(month);

  return (
    <div className="space-y-5">
      <PageHeader
        title={m.calendar.title}
        subtitle={m.calendar.subtitle}
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="quiet" onClick={() => setMonthOffset((v) => v - 1)}>
              <span className="rtl:rotate-180">←</span>
            </Button>
            <span className="min-w-32 text-center text-sm font-medium">
              {monthLabel}
            </span>
            <Button size="sm" variant="quiet" onClick={() => setMonthOffset((v) => v + 1)}>
              <span className="rtl:rotate-180">→</span>
            </Button>
            {monthOffset !== 0 ? (
              <Button size="sm" variant="ghost" onClick={() => setMonthOffset(0)}>
                {m.common.today}
              </Button>
            ) : null}
          </div>
        }
      />

      <DecisionPanel
        stats={teamStats.data ?? []}
        schedule={schedule.data ?? []}
        onDecided={() => {
          schedule.reload();
        }}
        locale={locale}
        actorId={user.id}
      />

      {/* --- Month grid ----------------------------------------------- */}
      <Card padded={false} className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border">
          {WEEK.map((d) => (
            <div
              key={d.key}
              className={cn(
                "px-2 py-2.5 text-center text-[11px] font-medium tracking-wide uppercase",
                d.type === "off" ? "text-faint" : "text-muted",
              )}
            >
              {locale === "ar" ? d.shortAr : d.short}
            </div>
          ))}
        </div>

        {attendance.loading ? (
          <Skeleton className="h-96 rounded-none" />
        ) : (
          <div className="grid grid-cols-7">
            {cells.map((date) => {
              const key = toDateKey(date);
              const inMonth = date.getMonth() === month.getMonth();
              const rule = dayRule(date.getDay());
              const records = attendanceByKey.get(key) ?? [];
              const decisions = scheduleByKey.get(key) ?? [];
              const isToday = key === todayKey;
              const isReview = date.getDay() === REVIEW_MEETING.day;

              return (
                <div
                  key={key}
                  className={cn(
                    "min-h-24 border-b border-e border-border p-1.5 last:border-e-0",
                    !inMonth && "opacity-35",
                    rule.type === "off" && "bg-bg-elev",
                    isToday && "bg-accent-softer ring-1 ring-accent/40 ring-inset",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={cn(
                        "tnum text-xs font-medium",
                        isToday ? "text-accent" : "text-muted",
                      )}
                    >
                      {date.getDate()}
                    </span>
                    {rule.type === "field" ? (
                      <span
                        className="size-1.5 rounded-full"
                        style={{ background: "var(--accent)" }}
                        title={m.calendar.fieldDay}
                      />
                    ) : rule.type === "conditional" ? (
                      <span
                        className="text-[9px] text-faint"
                        title={m.calendar.conditional}
                      >
                        ?
                      </span>
                    ) : null}
                  </div>

                  {isReview && inMonth ? (
                    <div className="mb-1 truncate rounded-sm bg-info-soft px-1 py-0.5 text-[9px] text-info">
                      {m.calendar.meetingDay}
                    </div>
                  ) : null}

                  <div className="space-y-0.5">
                    {records.map((a) => {
                      const member = PUBLIC_MEMBERS.find((p) => p.id === a.memberId);
                      return (
                        <div
                          key={a.id}
                          className="flex items-center gap-1 rounded-sm px-1 py-0.5 text-[9px]"
                          style={{
                            backgroundColor: `${ATTENDANCE_COLOR[a.status]}1a`,
                            color: ATTENDANCE_COLOR[a.status],
                          }}
                          title={[
                            member?.name,
                            a.checkInAt
                              ? `${formatTime(a.checkInAt)} → ${a.checkOutAt ? formatTime(a.checkOutAt) : "…"}`
                              : m.team.absent,
                            a.reason,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        >
                          <span className="font-semibold">#{member?.slot}</span>
                          <span className="tnum truncate">
                            {a.checkInAt ? formatTime(a.checkInAt) : "—"}
                          </span>
                        </div>
                      );
                    })}

                    {decisions.map((d) => {
                      const member = PUBLIC_MEMBERS.find((p) => p.id === d.memberId);
                      return (
                        <div
                          key={d.id}
                          className={cn(
                            "truncate rounded-sm px-1 py-0.5 text-[9px]",
                            d.dayType === "off"
                              ? "bg-surface-3 text-faint"
                              : "bg-accent-soft text-accent",
                          )}
                          title={d.note}
                        >
                          {member ? `#${member.slot} ` : ""}
                          {d.dayType === "off" ? m.calendar.dayOff : m.calendar.working}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* --- Legend ---------------------------------------------------- */}
      <Card>
        <CardHeader title={m.calendar.legend} />
        <div className="flex flex-wrap gap-4 text-xs">
          <Legend color="var(--success)" label={m.team.present} />
          <Legend color="var(--warn)" label={`${m.team.late} / ${m.calendar.checkedOutAt}`} />
          <Legend color="var(--critical)" label={m.team.absent} />
          <Legend color="var(--accent)" label={m.calendar.fieldDay} />
          <Legend color="var(--info)" label={m.calendar.meetingDay} />
          <span className="text-faint">
            {DEFAULT_START}–{DEFAULT_END}
          </span>
        </div>
      </Card>

      <WeekDetail locale={locale} />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="size-2.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="text-muted">{label}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * The Tuesday decision
 * ------------------------------------------------------------------ */

function DecisionPanel({
  stats,
  schedule,
  onDecided,
  locale,
  actorId,
}: {
  stats: import("@/lib/types").MemberStats[];
  schedule: ScheduleDay[];
  onDecided: () => void;
  locale: Locale;
  actorId: string;
}) {
  const { m } = useI18n();
  const [busy, setBusy] = useState("");

  const sunday = startOfWorkWeek(new Date());
  const days = CONDITIONAL_DAYS.map((d) => addDays(sunday, d));

  function decisionFor(dateKey: string, memberId: string) {
    return schedule.find((s) => s.date === dateKey && s.memberId === memberId);
  }

  async function decide(
    dateKey: string,
    memberId: string,
    dayType: "on" | "off",
    note: string,
  ) {
    setBusy(`${dateKey}:${memberId}`);
    try {
      await db().decideDay(dateKey, memberId, dayType, actorId, note);
      onDecided();
    } finally {
      setBusy("");
    }
  }

  if (!stats.length) return null;

  return (
    <Card>
      <CardHeader title={m.calendar.decideTitle} hint={m.calendar.decideHint} />

      <div className="space-y-3">
        {stats.map((s) => {
          const member = PUBLIC_MEMBERS.find((p) => p.id === s.memberId);
          if (!member) return null;
          const band = scoreBand(s.efficiency.total);
          const rec = wedThuRecommendation(s.efficiency.total);

          return (
            <div
              key={s.memberId}
              className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-2 p-3"
            >
              <Ring
                value={s.efficiency.total}
                size={52}
                stroke={5}
                color={band.color}
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <MemberBadge memberId={s.memberId} size="xs" />
                  <span className="truncate text-sm font-medium">
                    {locale === "ar" ? member.nameAr : member.name}
                  </span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: band.color }}
                  >
                    {locale === "ar" ? band.labelAr : band.label}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted">{rec.reason}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                {days.map((d) => {
                  const key = toDateKey(d);
                  const rule = dayRule(d.getDay());
                  const decision = decisionFor(key, s.memberId);
                  const loading = busy === `${key}:${s.memberId}`;

                  return (
                    <div key={key} className="text-center">
                      <div className="mb-1 text-[10px] text-faint">
                        {locale === "ar" ? rule.shortAr : rule.short}
                      </div>
                      <div className="inline-flex overflow-hidden rounded-md border border-border">
                        {(["on", "off"] as const).map((option) => {
                          const active = decision?.dayType === option;
                          const recommended = rec.suggest === option;
                          return (
                            <button
                              key={option}
                              type="button"
                              disabled={loading}
                              onClick={() =>
                                decide(key, s.memberId, option, rec.reason)
                              }
                              title={recommended ? m.calendar.recommend : undefined}
                              className={cn(
                                "px-2.5 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50",
                                active
                                  ? option === "on"
                                    ? "bg-accent text-accent-fg"
                                    : "bg-surface-3 text-fg"
                                  : "text-muted hover:text-fg",
                              )}
                            >
                              {option === "on" ? m.calendar.working : m.calendar.dayOff}
                              {recommended && !active ? (
                                <span className="ms-1 text-accent">•</span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * This week, per member, in detail
 * ------------------------------------------------------------------ */

function WeekDetail({ locale }: { locale: Locale }) {
  const { m } = useI18n();
  const mounted = useMounted();
  const range = useMemo(() => rangeFor("week"), []);

  const data = useAsync(
    () =>
      mounted
        ? Promise.all(
            PUBLIC_MEMBERS.map(async (p) => ({
              member: p,
              rows: await db().attendanceFor(p.id, range),
            })),
          )
        : Promise.resolve([]),
    [mounted, range.from],
  );

  if (data.loading) return <Skeleton className="h-40" />;

  return (
    <Card>
      <CardHeader title={m.calendar.week} hint={m.team.attendance} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] tracking-wide text-muted uppercase">
              <th className="py-2 text-start font-medium">{m.team.title}</th>
              {WEEK.filter((d) => d.scored).map((d) => (
                <th key={d.key} className="py-2 text-center font-medium">
                  {locale === "ar" ? d.labelAr : d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data.data ?? []).map(({ member, rows }) => (
              <tr key={member.id} className="border-b border-border last:border-0">
                <td className="py-2.5">
                  <span className="flex items-center gap-2">
                    <MemberBadge memberId={member.id} size="xs" />
                    <span className="text-sm">
                      {locale === "ar" ? member.nameAr : member.name}
                    </span>
                  </span>
                </td>
                {WEEK.filter((d) => d.scored).map((d) => {
                  const dateKey = toDateKey(addDays(startOfWorkWeek(new Date()), d.day));
                  const record = rows.find((r) => r.date === dateKey);
                  return (
                    <td key={d.key} className="py-2.5 text-center">
                      {!record ? (
                        <span className="text-xs text-faint">—</span>
                      ) : (
                        <span
                          className="tnum inline-flex flex-col rounded-md px-2 py-1 text-[11px]"
                          style={{
                            backgroundColor: `${ATTENDANCE_COLOR[record.status]}1a`,
                            color: ATTENDANCE_COLOR[record.status],
                          }}
                          title={record.reason}
                        >
                          <span>
                            {record.checkInAt ? formatTime(record.checkInAt) : "—"}
                            {record.checkOutAt
                              ? ` → ${formatTime(record.checkOutAt)}`
                              : ""}
                          </span>
                          {record.reason ? (
                            <span className="max-w-28 truncate opacity-80">
                              {record.reason}
                            </span>
                          ) : null}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
