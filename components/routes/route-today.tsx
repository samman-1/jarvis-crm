"use client";

import Link from "next/link";
import { addDays } from "date-fns";
import { useMemo } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSession } from "@/components/providers/session-provider";
import { useAsync, useMounted } from "@/lib/hooks/use-async";
import { db } from "@/lib/data";
import { Button, Card, CardHeader, Skeleton } from "@/components/ui/primitives";
import type { ClientRow, DayRoute } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";
import { toDateKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Today's plan, on the page you land on.
 *
 * Shows today's route if there is one, otherwise the next one coming up, so
 * "where am I going" is answered without navigating anywhere. Stops tick off
 * from here — on a field day this is the only screen you need open.
 */
export function RouteToday({ locale }: { locale: Locale }) {
  const { m } = useI18n();
  const { user } = useSession();
  const mounted = useMounted();

  const routes = useAsync(
    () =>
      mounted
        ? db().listRoutes(user.id, { from: toDateKey(new Date()) })
        : Promise.resolve([] as DayRoute[]),
    [mounted, user.id],
  );

  const clients = useAsync(
    () => (mounted ? db().listClients() : Promise.resolve([] as ClientRow[])),
    [mounted],
  );

  const today = toDateKey(new Date());
  const upcoming = routes.data ?? [];
  const route = useMemo(
    () => upcoming.find((r) => r.date === today) ?? upcoming[0] ?? null,
    [upcoming, today],
  );

  const byId = useMemo(
    () => new Map((clients.data ?? []).map((c) => [c.id, c])),
    [clients.data],
  );

  if (!mounted || routes.loading) return <Skeleton className="h-32" />;

  const isToday = route?.date === today;
  const dateLabel = route
    ? new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
        weekday: "long",
        day: "numeric",
        month: "short",
      }).format(new Date(`${route.date}T12:00:00`))
    : "";

  const mapsUrl = (() => {
    if (!route) return "";
    const points = route.stops
      .map((s) => {
        if (s.addressOverride.trim()) return s.addressOverride.trim();
        const c = byId.get(s.clientId);
        if (c) return [c.address, c.name, c.city].filter(Boolean).join(", ");
        // Stops with no client behind them still map: the label is the search.
        return (s.label ?? "").trim();
      })
      .filter(Boolean)
      .map(encodeURIComponent);
    if (!points.length) return "";
    return (
      "https://www.google.com/maps/dir/?api=1" +
      `&destination=${points[points.length - 1]}` +
      (points.length > 1 ? `&waypoints=${points.slice(0, -1).join("|")}` : "") +
      "&travelmode=driving"
    );
  })();

  return (
    <Card>
      <CardHeader
        title={isToday ? m.routes.todayTitle : m.routes.nextTitle}
        // An empty route is not a plan, so it does not get a date. Showing
        // "Sunday 2 Aug" above "no route planned" read as a contradiction.
        hint={route && route.stops.length > 0 ? dateLabel : undefined}
        action={
          <Link href={`/${locale}/routes`}>
            <Button size="sm" variant="secondary">
              {route ? m.common.edit : m.routes.planOne}
            </Button>
          </Link>
        }
      />

      {!route || route.stops.length === 0 ? (
        <p className="text-xs text-faint">{m.routes.noneToday}</p>
      ) : (
        <>
          <ol className="space-y-1.5">
            {route.stops.map((stop, i) => {
              const client = byId.get(stop.clientId);
              return (
                <li
                  key={stop.clientId || `plain-${i}`}
                  className="flex items-center gap-2.5"
                >
                  <button
                    type="button"
                    aria-label={m.routes.markVisited}
                    onClick={async () => {
                      await db().updateRoute(route.id, {
                        stops: route.stops.map((s, j) =>
                          j === i ? { ...s, done: !s.done } : s,
                        ),
                      });
                      routes.reload();
                    }}
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors",
                      stop.done
                        ? "border-success bg-success text-white"
                        : "border-border-strong text-muted hover:border-accent",
                    )}
                  >
                    {stop.done ? "✓" : i + 1}
                  </button>
                  {stop.clientId ? (
                    <Link
                      href={`/${locale}/clients/${stop.clientId}`}
                      className={cn(
                        "min-w-0 flex-1 truncate text-sm hover:text-accent",
                        stop.done && "text-faint line-through",
                      )}
                    >
                      {client
                        ? locale === "ar" && client.nameAr
                          ? client.nameAr
                          : client.name
                        : ""}
                    </Link>
                  ) : (
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-sm",
                        stop.done && "text-faint line-through",
                      )}
                    >
                      {stop.label ?? ""}
                    </span>
                  )}
                  {client?.city ? (
                    <span className="shrink-0 text-[11px] text-faint">
                      {client.city}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>

          {mapsUrl ? (
            <a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-3 block">
              <Button size="sm" variant="primary" className="w-full">
                {m.routes.openInMaps}
              </Button>
            </a>
          ) : null}
        </>
      )}
    </Card>
  );
}
