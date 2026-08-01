"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSession } from "@/components/providers/session-provider";
import { useAsync, useMounted } from "@/lib/hooks/use-async";
import { db } from "@/lib/data";
import {
  Bar,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Ring,
  Skeleton,
  Stat,
} from "@/components/ui/primitives";
import {
  FreshnessChip,
  InteractionIcon,
  InteractionLabel,
  StageChip,
} from "@/components/ui/badges";
import { PageHeader } from "@/components/shell/page-header";
import { HoursGrid } from "@/components/attendance/hours-grid";
import { RouteToday } from "@/components/routes/route-today";
import { RemindersPanel } from "@/components/reminders/reminders";
import { ComingSoon } from "@/components/ui/coming-soon";
import { ReminderBanner } from "@/components/reminders/reminders";
import { TaskPanel } from "@/components/tasks/task-panel";
import { QuickLog } from "@/components/clients/quick-log";
import {
  ASK_JARVIS_ENABLED,
  EFFICIENCY_ENABLED,
  HOURS_ENABLED,
  breakdownBars,
  scoreBand,
} from "@/lib/efficiency";
import { rangeFor } from "@/lib/dates";
import { formatDateTime, formatTime, relativeDays } from "@/lib/dates";
import { formatMinutes, cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";
import type { ClientRow } from "@/lib/types";

export function Dashboard({ locale }: { locale: Locale }) {
  const { m } = useI18n();
  const { user, member } = useSession();
  const mounted = useMounted();

  const range = useMemo(() => rangeFor("week"), []);
  // Held here rather than inside QuickLog so the empty timeline below can
  // open the same form instead of sending you somewhere else.
  const [logOpen, setLogOpen] = useState(false);

  const stats = useAsync(
    () => (mounted ? db().memberStats(user.id, range) : Promise.resolve(null)),
    [mounted, user.id, range.from],
  );
  const clients = useAsync(
    () => (mounted ? db().listClients({ ownerId: user.id }) : Promise.resolve([])),
    [mounted, user.id],
  );
  // Completed tasks are fetched too — the panel keeps them behind a
  // "show completed" toggle so ticking something off does not make it vanish.
  const tasks = useAsync(
    () => (mounted ? db().listTasks({ assigneeId: user.id }) : Promise.resolve([])),
    [mounted, user.id],
  );
  const allClients = useAsync(
    () => (mounted ? db().listClients() : Promise.resolve([])),
    [mounted],
  );
  const recent = useAsync(
    () =>
      mounted
        ? db().listInteractions({ memberId: user.id, range, limit: 12 })
        : Promise.resolve([]),
    [mounted, user.id, range.from],
  );

  // The server has no idea what time it is where you are, so the greeting is
  // decided after mount rather than guessed during SSR.
  const hour = new Date().getHours();
  const greeting = !mounted
    ? m.dashboard.greetingMorning
    : hour < 12
      ? m.dashboard.greetingMorning
      : hour < 17
        ? m.dashboard.greetingAfternoon
        : m.dashboard.greetingEvening;

  const s = stats.data;

  /* Your own book, still in play, with anything going cold floated to the
     top. This is the list you scan before deciding where to drive. */
  const mine = useMemo<ClientRow[]>(() => {
    const rows = (clients.data ?? []).filter((c) => c.status !== "dead");
    return [...rows].sort((a, b) => {
      if (a.isStale !== b.isStale) return a.isStale ? -1 : 1;
      return (b.interactionCount ?? 0) - (a.interactionCount ?? 0);
    });
  }, [clients.data]);

  /* The subset that has actually gone quiet. Kept separate from the list
     above so it reads as a to-do, not as a second copy of the same names. */
  const goingCold = useMemo(
    () => mine.filter((c) => c.isStale && c.status === "active"),
    [mine],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${greeting}, ${locale === "ar" ? member.nameAr : member.name}`}
        subtitle={m.dashboard.subtitle}
      />

      {/* Anything due or nearly due interrupts before the numbers do. */}
      <ReminderBanner locale={locale} />

      {/* --- KPI strip ------------------------------------------------ */}
      {stats.loading || !s ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label={m.dashboard.clientsTouched} value={s.clientsTouched} />
          <Stat label={m.dashboard.meetings} value={s.meetings} />
          <Stat label={m.dashboard.newLeads} value={s.newClients} />
          <Stat
            label={m.dashboard.proposalsOut}
            value={s.proposalsSent}
            accent={s.proposalsSent > 0 ? "var(--accent)" : undefined}
          />
          <Stat
            label={m.dashboard.won}
            value={s.won}
            accent={s.won > 0 ? "var(--success)" : undefined}
          />
          {HOURS_ENABLED ? (
            <Stat
              label={m.dashboard.hours}
              value={formatMinutes(s.minutesWorked)}
              sub={`${formatMinutes(s.minutesPlanned)} ${m.dashboard.ofTarget}`}
            />
          ) : (
            <Stat label={m.team.activity} value={s.interactions} />
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* --- Main column ------------------------------------------- */}
        <div className="space-y-4 lg:col-span-2">
          <QuickLog
            clients={allClients.data ?? []}
            locale={locale}
            open={logOpen}
            onOpenChange={setLogOpen}
            onLogged={() => {
              recent.reload();
              stats.reload();
              clients.reload();
              allClients.reload();
            }}
          />

          {/* Your own clients, on the page you land on. Previously this
              lived one tap away and the home page could show an empty week
              while six companies sat waiting. */}
          <Card>
            <CardHeader
              title={m.dashboard.myClients}
              hint={m.dashboard.myClientsHint}
              action={
                <div className="flex items-center gap-2">
                  {mine.length > 0 ? (
                    <span className="tnum text-xs text-faint">
                      {mine.length}
                    </span>
                  ) : null}
                  <Link href={`/${locale}/clients`}>
                    <Button size="sm" variant="secondary">
                      {m.dashboard.seeAll}
                    </Button>
                  </Link>
                </div>
              }
            />
            {clients.loading ? (
              <Skeleton className="h-40" />
            ) : mine.length === 0 ? (
              <EmptyState
                title={m.dashboard.noClientsYet}
                hint={m.clients.mineSubtitle}
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Link href={`/${locale}/clients/new`}>
                      <Button size="sm" variant="primary">
                        {m.nav.newClient}
                      </Button>
                    </Link>
                    <Link href={`/${locale}/clients/import`}>
                      <Button size="sm" variant="secondary">
                        {m.nav.import}
                      </Button>
                    </Link>
                  </div>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {mine.slice(0, 8).map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/${locale}/clients/${c.id}`}
                      className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-surface-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {locale === "ar" && c.nameAr ? c.nameAr : c.name}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <StageChip stage={c.stage} />
                          {c.city ? (
                            <span className="truncate text-[11px] text-faint">
                              {c.city}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <FreshnessChip
                          days={c.daysSinceContact}
                          stale={c.isStale}
                        />
                        {c.nextAction ? (
                          <span className="max-w-32 truncate text-[11px] text-faint">
                            {c.nextAction}
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {mine.length > 8 ? (
              <Link
                href={`/${locale}/clients`}
                className="mt-3 block text-center text-xs text-muted transition-colors hover:text-accent"
              >
                {m.dashboard.seeAll} ({mine.length})
              </Link>
            ) : null}
          </Card>

          <Card>
            <CardHeader
              title={m.dashboard.timeline}
              hint={m.dashboard.thisWeek}
              action={
                <Link href={`/${locale}/clients/import?mode=activity`}>
                  <Button size="sm" variant="secondary">
                    {m.actions.logMany}
                  </Button>
                </Link>
              }
            />
            {recent.loading ? (
              <Skeleton className="h-40" />
            ) : (recent.data ?? []).length === 0 ? (
              /* This used to offer "All clients", which answered a question
                 nobody standing here was asking. The two things you actually
                 want are to log one thing, or to paste the whole week. */
              <EmptyState
                title={m.dashboard.nothingLogged}
                hint={m.dashboard.startYourWeek}
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => setLogOpen(true)}
                    >
                      + {m.actions.quickLog}
                    </Button>
                    <Link href={`/${locale}/clients/import?mode=activity`}>
                      <Button size="sm" variant="secondary">
                        {m.actions.logMany}
                      </Button>
                    </Link>
                  </div>
                }
              />
            ) : (
              <ol className="space-y-3">
                {(recent.data ?? []).map((i) => (
                  <li key={i.id} className="flex items-start gap-3">
                    <InteractionIcon type={i.type} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-medium">
                          <InteractionLabel type={i.type} />
                        </span>
                        <span className="tnum text-xs text-faint">
                          {formatDateTime(i.happenedAt, locale)}
                        </span>
                      </div>
                      <p className="truncate text-sm text-muted">{i.summary}</p>
                    </div>
                    <Link
                      href={`/${locale}/clients/${i.clientId}`}
                      className="shrink-0 text-xs text-faint transition-colors hover:text-accent"
                    >
                      {m.common.open}
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {tasks.loading ? (
            <Skeleton className="h-40" />
          ) : (
            <TaskPanel
              tasks={tasks.data ?? []}
              clients={allClients.data ?? []}
              locale={locale}
              onChanged={() => {
                tasks.reload();
                stats.reload();
              }}
            />
          )}
        </div>

        {/* --- Right rail -------------------------------------------- */}
        <div className="space-y-4">
          {/* The whole day on one screen: where you are going, what you owe
              yourself, who is warm. Nothing here needs another page. */}
          <RouteToday locale={locale} />

          <RemindersPanel locale={locale} clients={allClients.data ?? []} />

          <Card>
            <CardHeader
              title={m.dashboard.needsAttention}
              hint={m.dashboard.needsAttentionHint}
            />
            {clients.loading ? (
              <Skeleton className="h-24" />
            ) : goingCold.length === 0 ? (
              <p className="text-xs text-faint">{m.dashboard.allWarm}</p>
            ) : (
              <ul className="space-y-2">
                {goingCold.slice(0, 6).map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/${locale}/clients/${c.id}`}
                      className={cn(
                        "block rounded-md border border-border bg-surface-2 p-3 transition-colors hover:border-border-strong",
                        c.isStale && "border-warn/40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {locale === "ar" && c.nameAr ? c.nameAr : c.name}
                        </span>
                        <FreshnessChip days={c.daysSinceContact} stale={c.isStale} />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <StageChip stage={c.stage} />
                        {c.nextActionAt ? (
                          <span className="truncate text-[11px] text-faint">
                            {relativeDays(c.nextActionAt, locale)}
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {EFFICIENCY_ENABLED ? (
          <Card>
            <CardHeader
              title={m.dashboard.efficiency}
              hint={m.dashboard.efficiencyHint}
            />
            {stats.loading || !s ? (
              <Skeleton className="h-40" />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Ring
                    value={s.efficiency.total}
                    color={scoreBand(s.efficiency.total).color}
                    label={
                      locale === "ar"
                        ? scoreBand(s.efficiency.total).labelAr
                        : scoreBand(s.efficiency.total).label
                    }
                  />
                  <div className="min-w-0 flex-1 space-y-1.5 text-xs">
                    <Line
                      label={m.team.present}
                      value={`${s.daysPresent}`}
                    />
                    <Line label={m.team.late} value={`${s.daysLate}`} />
                    <Line label={m.team.absent} value={`${s.daysAbsent}`} />
                    <Line
                      label={m.team.tasksOverdue}
                      value={`${s.tasksOverdue}`}
                      tone={s.tasksOverdue ? "var(--critical)" : undefined}
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  {breakdownBars(s.efficiency).map((b) => (
                    <div key={b.key}>
                      <div className="mb-1 flex items-baseline justify-between text-[11px]">
                        <span className="text-muted">
                          {locale === "ar" ? b.labelAr : b.label}
                        </span>
                        <span className="tnum text-faint">
                          {b.earned}/{b.max}
                        </span>
                      </div>
                      <Bar
                        percent={b.percent}
                        color={scoreBand(s.efficiency.total).color}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
          ) : (
            <>
              <ComingSoon />
              <ComingSoon title={m.hours.title} note={m.hours.offBody} />
            </>
          )}

          {ASK_JARVIS_ENABLED ? null : (
            <ComingSoon title={m.ask.title} note={m.ask.offBody} />
          )}

        </div>
      </div>
    </div>
  );
}

function Line({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="truncate text-muted">{label}</span>
      <span className="tnum font-medium" style={tone ? { color: tone } : undefined}>
        {value}
      </span>
    </div>
  );
}


export { formatTime };
