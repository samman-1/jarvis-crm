"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSession } from "@/components/providers/session-provider";
import { useAsync, useMounted } from "@/lib/hooks/use-async";
import { db } from "@/lib/data";
import {
  Bar,
  Card,
  CardHeader,
  EmptyState,
  Ring,
  Skeleton,
  Stat,
} from "@/components/ui/primitives";
import {
  FreshnessChip,
  MemberBadge,
  StageChip,
  StatusChip,
} from "@/components/ui/badges";
import { PageHeader } from "@/components/shell/page-header";
import { PUBLIC_MEMBERS } from "@/lib/config/members";
import { breakdownBars, scoreBand } from "@/lib/efficiency";
import { rangeFor } from "@/lib/dates";
import type { RangeKey } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";
import { cn, formatMinutes, formatSar } from "@/lib/utils";

/**
 * The answer to "what has everyone else been doing?".
 *
 * Defaults to whoever you are *not* — opening your own page here would be
 * pointless when the dashboard already covers it.
 */
export function TeamView({ locale }: { locale: Locale }) {
  const { m } = useI18n();
  const { user } = useSession();
  const mounted = useMounted();

  const others = PUBLIC_MEMBERS.filter((p) => p.id !== user.id);
  const [selected, setSelected] = useState<string>(others[0]?.id ?? user.id);
  const [rangeKey, setRangeKey] = useState<RangeKey>("week");
  const [compare, setCompare] = useState(false);

  const range = useMemo(() => rangeFor(rangeKey), [rangeKey]);

  const team = useAsync(
    () => (mounted ? db().teamStats(range) : Promise.resolve([])),
    [mounted, range.from, range.to],
  );

  const clients = useAsync(
    () =>
      mounted && !compare
        ? db().listClients({ ownerId: selected })
        : Promise.resolve([]),
    [mounted, selected, compare],
  );

  const ranges: { key: RangeKey; label: string }[] = [
    { key: "week", label: m.team.week },
    { key: "month", label: m.team.month },
    { key: "quarter", label: m.team.quarter },
  ];

  const stats = team.data ?? [];
  const current = stats.find((s) => s.memberId === selected);

  return (
    <div className="space-y-5">
      <PageHeader title={m.team.title} subtitle={m.team.subtitle} />

      {/* --- Controls ------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {PUBLIC_MEMBERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setSelected(p.id);
                setCompare(false);
              }}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                !compare && selected === p.id
                  ? "border-transparent"
                  : "border-border text-muted hover:text-fg",
              )}
              style={
                !compare && selected === p.id
                  ? { backgroundColor: `${p.color}1f`, color: p.color, borderColor: p.color }
                  : undefined
              }
            >
              <MemberBadge memberId={p.id} size="xs" />
              {locale === "ar" ? p.nameAr : p.name}
              {p.id === user.id ? (
                <span className="text-xs text-faint">({m.common.you})</span>
              ) : null}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCompare(true)}
            className={cn(
              "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
              compare
                ? "border-accent bg-accent-soft text-accent"
                : "border-border text-muted hover:text-fg",
            )}
          >
            {m.team.compare}
          </button>
        </div>

        <div className="ms-auto inline-flex overflow-hidden rounded-md border border-border">
          {ranges.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRangeKey(r.key)}
              className={cn(
                "px-3 py-2 text-xs font-medium transition-colors",
                rangeKey === r.key
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:text-fg",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {team.loading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : compare ? (
        <CompareGrid stats={stats} locale={locale} />
      ) : current ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label={m.dashboard.clientsTouched} value={current.clientsTouched} />
            <Stat label={m.dashboard.meetings} value={current.meetings} />
            <Stat label={m.team.activity} value={current.interactions} />
            <Stat label={m.dashboard.proposalsOut} value={current.proposalsSent} />
            <Stat
              label={m.team.tasksDone}
              value={current.tasksDone}
              sub={
                current.tasksOverdue
                  ? `${current.tasksOverdue} ${m.team.tasksOverdue.toLowerCase()}`
                  : undefined
              }
            />
            <Stat
              label={m.dashboard.hours}
              value={formatMinutes(current.minutesWorked)}
              sub={`${formatMinutes(current.minutesPlanned)} ${m.dashboard.ofTarget}`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader
                title={m.team.efficiencyTrend}
                hint={range.label}
              />
              <div className="flex items-center gap-4">
                <Ring
                  value={current.efficiency.total}
                  color={scoreBand(current.efficiency.total).color}
                  label={
                    locale === "ar"
                      ? scoreBand(current.efficiency.total).labelAr
                      : scoreBand(current.efficiency.total).label
                  }
                />
                <div className="min-w-0 flex-1 space-y-2">
                  {breakdownBars(current.efficiency).map((b) => (
                    <div key={b.key}>
                      <div className="mb-1 flex items-baseline justify-between text-[11px]">
                        <span className="truncate text-muted">
                          {locale === "ar" ? b.labelAr : b.label}
                        </span>
                        <span className="tnum text-faint">
                          {b.earned}/{b.max}
                        </span>
                      </div>
                      <Bar
                        percent={b.percent}
                        color={scoreBand(current.efficiency.total).color}
                        height="h-1"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <MiniStat label={m.team.present} value={current.daysPresent} />
                <MiniStat
                  label={m.team.late}
                  value={current.daysLate}
                  color={current.daysLate ? "var(--warn)" : undefined}
                />
                <MiniStat
                  label={m.team.absent}
                  value={current.daysAbsent}
                  color={current.daysAbsent ? "var(--critical)" : undefined}
                />
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader title={m.team.activity} hint={m.team.activityHint} />
              <ActivityStrip data={current.activityByDay} locale={locale} />
            </Card>
          </div>

          <Card>
            <CardHeader
              title={m.team.pipeline}
              hint={`${(clients.data ?? []).length} ${m.clients.count}`}
            />
            {clients.loading ? (
              <Skeleton className="h-40" />
            ) : (clients.data ?? []).length === 0 ? (
              <EmptyState title={m.clients.noResults} />
            ) : (
              <ul className="divide-y divide-border">
                {(clients.data ?? []).map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/${locale}/clients/${c.id}`}
                      className="flex flex-wrap items-center gap-3 py-2.5 transition-colors hover:text-accent"
                    >
                      {/* Full width on a phone: squeezing the name onto the
                          same line as four chips truncated it to "Ibn …". */}
                      <span
                        className={cn(
                          "w-full min-w-0 truncate text-sm font-medium sm:w-auto sm:flex-1",
                          c.status === "dead" && "text-critical line-through",
                        )}
                      >
                        {locale === "ar" && c.nameAr ? c.nameAr : c.name}
                      </span>
                      <StageChip stage={c.stage} />
                      <StatusChip status={c.status} compact />
                      <FreshnessChip days={c.daysSinceContact} stale={c.isStale} />
                      <span className="tnum w-20 text-end text-xs text-muted">
                        {c.dealValueSar ? formatSar(c.dealValueSar) : "—"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="rounded-md bg-surface-2 px-2 py-2">
      <div
        className="tnum font-display text-lg font-semibold"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  );
}

/** One bar per day. Weekends stay visible but greyed, so gaps read as gaps. */
function ActivityStrip({
  data,
  locale,
}: {
  data: { date: string; count: number }[];
  locale: Locale;
}) {
  const { m } = useI18n();
  const max = Math.max(1, ...data.map((d) => d.count));

  if (!data.length) return <p className="text-xs text-faint">{m.team.noActivity}</p>;

  return (
    <div className="flex items-end gap-1 overflow-x-auto pb-1">
      {data.map((d) => {
        const day = new Date(`${d.date}T00:00:00`).getDay();
        const weekend = day === 5 || day === 6;
        const height = d.count ? Math.max(8, (d.count / max) * 96) : 3;
        return (
          <div
            key={d.date}
            className="group flex min-w-3 flex-1 flex-col items-center gap-1"
            title={`${new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
              day: "numeric",
              month: "short",
            }).format(new Date(`${d.date}T00:00:00`))} — ${d.count}`}
          >
            <span
              className="w-full rounded-sm transition-colors"
              style={{
                height,
                backgroundColor: d.count
                  ? weekend
                    ? "var(--surface-3)"
                    : "var(--accent)"
                  : "var(--surface-3)",
                opacity: d.count ? 0.55 + (d.count / max) * 0.45 : 1,
              }}
            />
            {data.length <= 14 ? (
              <span className="tnum text-[9px] text-faint">
                {d.date.slice(-2)}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function CompareGrid({
  stats,
  locale,
}: {
  stats: import("@/lib/types").MemberStats[];
  locale: Locale;
}) {
  const { m } = useI18n();

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {stats.map((s) => {
        const member = PUBLIC_MEMBERS.find((p) => p.id === s.memberId);
        if (!member) return null;
        const band = scoreBand(s.efficiency.total);
        return (
          <Card key={s.memberId}>
            <div className="mb-4 flex items-center gap-3">
              <MemberBadge memberId={s.memberId} size="md" />
              <div className="min-w-0">
                <div className="truncate font-display text-sm font-semibold">
                  {locale === "ar" ? member.nameAr : member.name}
                </div>

              </div>
              <div className="ms-auto">
                <Ring
                  value={s.efficiency.total}
                  size={64}
                  stroke={6}
                  color={band.color}
                />
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <Row label={m.dashboard.clientsTouched} value={s.clientsTouched} />
              <Row label={m.team.activity} value={s.interactions} />
              <Row label={m.dashboard.meetings} value={s.meetings} />
              <Row label={m.dashboard.proposalsOut} value={s.proposalsSent} />
              <Row label={m.team.tasksDone} value={s.tasksDone} />
              <Row
                label={m.team.tasksOverdue}
                value={s.tasksOverdue}
                color={s.tasksOverdue ? "var(--critical)" : undefined}
              />
              <Row
                label={m.dashboard.hours}
                value={formatMinutes(s.minutesWorked)}
              />
              <Row
                label={m.team.late}
                value={s.daysLate}
                color={s.daysLate ? "var(--warn)" : undefined}
              />
              <Row
                label={m.team.absent}
                value={s.daysAbsent}
                color={s.daysAbsent ? "var(--critical)" : undefined}
              />
            </div>

            <div className="mt-4 space-y-2">
              {breakdownBars(s.efficiency).map((b) => (
                <div key={b.key}>
                  <div className="mb-1 flex items-baseline justify-between text-[10px]">
                    <span className="truncate text-muted">
                      {locale === "ar" ? b.labelAr : b.label}
                    </span>
                    <span className="tnum text-faint">
                      {b.earned}/{b.max}
                    </span>
                  </div>
                  <Bar percent={b.percent} color={band.color} height="h-1" />
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function Row({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="truncate text-muted">{label}</span>
      <span
        className="tnum font-medium"
        style={color ? { color } : undefined}
      >
        {value}
      </span>
    </div>
  );
}
