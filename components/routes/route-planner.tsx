"use client";

import Link from "next/link";
import { addDays } from "date-fns";
import { useMemo, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSession } from "@/components/providers/session-provider";
import { useAsync, useMounted } from "@/lib/hooks/use-async";
import { db } from "@/lib/data";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  Select,
  Skeleton,
} from "@/components/ui/primitives";
import { StageChip } from "@/components/ui/badges";
import { PageHeader } from "@/components/shell/page-header";
import type { ClientRow, DayRoute, RouteStop } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";
import { toDateKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Plan a day out before you leave.
 *
 * Written the night before — "Sunday I'm going to these four" — reordered by
 * hand, then ticked off during the day.
 *
 * Two deliberate decisions:
 *   1. It works with no addresses whatsoever. A plain ordered list of company
 *      names is a perfectly good route, and demanding an address before you
 *      can plan a day would make the feature useless.
 *   2. Maps are optional and free. Whatever addresses exist get handed to
 *      Google Maps through its public URL scheme — no API key, no billing,
 *      no account. The trade-off is that Google routes the stops in the order
 *      given rather than reordering them for you, so the ordering stays a
 *      human decision with a "group by area" helper.
 */
export function RoutePlanner({ locale }: { locale: Locale }) {
  const { m } = useI18n();
  const { user } = useSession();
  const mounted = useMounted();

  const [openId, setOpenId] = useState("");
  const [newDate, setNewDate] = useState(toDateKey(addDays(new Date(), 1)));
  const [busy, setBusy] = useState(false);

  const routes = useAsync(
    () =>
      mounted
        ? db().listRoutes(user.id, { from: toDateKey(addDays(new Date(), -14)) })
        : Promise.resolve([] as DayRoute[]),
    [mounted, user.id],
  );

  const clients = useAsync(
    () => (mounted ? db().listClients() : Promise.resolve([] as ClientRow[])),
    [mounted],
  );

  async function create() {
    setBusy(true);
    try {
      const label = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
        weekday: "long",
      }).format(new Date(`${newDate}T12:00:00`));
      const route = await db().createRoute(user.id, newDate, label);
      routes.reload();
      setOpenId(route.id);
    } finally {
      setBusy(false);
    }
  }

  if (!mounted || routes.loading) {
    return <Skeleton className="h-64" />;
  }

  const list = routes.data ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={m.routes.title} subtitle={m.routes.subtitle} />

      <Card>
        <CardHeader title={m.routes.planADay} hint={m.routes.planHint} />
        <div className="flex flex-wrap gap-2">
          <Input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="h-11 flex-1"
            dir="ltr"
          />
          <Button variant="primary" onClick={create} disabled={busy}>
            {busy ? m.common.saving : m.routes.create}
          </Button>
        </div>
      </Card>

      {list.length === 0 ? (
        <EmptyState title={m.routes.empty} hint={m.routes.emptyHint} />
      ) : (
        list.map((route) => (
          <RouteCard
            key={route.id}
            route={route}
            clients={clients.data ?? []}
            locale={locale}
            expanded={openId === route.id}
            onToggle={() => setOpenId(openId === route.id ? "" : route.id)}
            onChanged={routes.reload}
            m={m}
          />
        ))
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function RouteCard({
  route,
  clients,
  locale,
  expanded,
  onToggle,
  onChanged,
  m,
}: {
  route: DayRoute;
  clients: ClientRow[];
  locale: Locale;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
  m: ReturnType<typeof useI18n>["m"];
}) {
  const [adding, setAdding] = useState("");
  // Off by default: the list is the route, the map is a second opinion.
  const [showMap, setShowMap] = useState(false);

  const byId = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients],
  );

  const nameOf = (id: string) => {
    const c = byId.get(id);
    if (!c) return "";
    return locale === "ar" && c.nameAr ? c.nameAr : c.name;
  };

  /** What Google Maps should search for: an address if we have one, else the
   *  company name plus its city, which finds most businesses. */
  const queryFor = (stop: RouteStop) => {
    if (stop.addressOverride.trim()) return stop.addressOverride.trim();
    const c = byId.get(stop.clientId);
    if (!c) return "";
    return [c.address, c.name, c.city].filter(Boolean).join(", ");
  };

  const mappable = route.stops.filter((s) => queryFor(s));

  const mapsUrl = useMemo(() => {
    if (mappable.length === 0) return "";
    const points = mappable.map((s) => encodeURIComponent(queryFor(s)));
    const destination = points[points.length - 1];
    const waypoints = points.slice(0, -1).join("|");
    // Google's public URL scheme: no API key, opens in the Maps app on a phone.
    return (
      "https://www.google.com/maps/dir/?api=1" +
      `&destination=${destination}` +
      (waypoints ? `&waypoints=${waypoints}` : "") +
      "&travelmode=driving"
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.stops, clients]);

  /**
   * The same stops, drawn instead of listed. No API key, no billing account.
   *
   * This has to address /maps/embed directly. The friendlier-looking
   * `maps.google.com/maps?...&output=embed` is a 301 to exactly this URL, and
   * the redirect response carries `X-Frame-Options: SAMEORIGIN`, so a browser
   * refuses to render it in a frame and you get a silent blank rectangle. The
   * endpoint below answers 200 with no such header.
   *
   * `pb` is Google's own packed parameter format. One place is a pin; two or
   * more is a driving line through them, in the order the stops are listed:
   *
   *   pin          !1m3!2m1!1s<place>!6i<zoom>
   *   directions   !1m{2n+1}!4m{2n}  then  !4m1!2s<place>  per place
   */
  const embedUrl = useMemo(() => {
    if (mappable.length === 0) return "";

    // Spaces are "+" inside pb, and "!" is the delimiter, so it cannot survive
    // inside a place name.
    const place = (s: RouteStop) =>
      encodeURIComponent(queryFor(s).replace(/!/g, " ")).replace(/%20/g, "+");

    const points = mappable.map(place);
    const pb =
      points.length === 1
        ? `!1m3!2m1!1s${points[0]}!6i13`
        : `!1m${2 * points.length + 1}!4m${2 * points.length}` +
          points.map((p) => `!4m1!2s${p}`).join("");

    return `https://www.google.com/maps/embed?origin=mfe&pb=${pb}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.stops, clients]);

  async function patchStops(stops: RouteStop[]) {
    await db().updateRoute(route.id, { stops });
    onChanged();
  }

  async function addStop(clientId: string) {
    if (!clientId || route.stops.some((s) => s.clientId === clientId)) return;
    await patchStops([
      ...route.stops,
      { clientId, addressOverride: "", note: "", done: false },
    ]);
    setAdding("");
  }

  function move(index: number, by: number) {
    const next = [...route.stops];
    const target = index + by;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void patchStops(next);
  }

  /** Not a solver — just puts stops in the same city next to each other, which
   *  is most of the benefit for a city like Riyadh. */
  function groupByArea() {
    const key = (s: RouteStop) => (byId.get(s.clientId)?.city ?? "").toLowerCase();
    const sorted = [...route.stops].sort((a, b) => key(a).localeCompare(key(b)));
    void patchStops(sorted);
  }

  const doneCount = route.stops.filter((s) => s.done).length;
  const dateLabel = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(new Date(`${route.date}T12:00:00`));

  const available = clients.filter(
    (c) => c.status !== "dead" && !route.stops.some((s) => s.clientId === c.id),
  );

  return (
    <Card>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 text-start"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-semibold">
            {dateLabel}
          </span>
          <span className="block text-xs text-muted">
            {route.stops.length === 0
              ? m.routes.noStops
              : `${route.stops.length} ${m.routes.stops}${
                  doneCount ? ` · ${doneCount} ${m.routes.visited}` : ""
                }`}
          </span>
        </span>
        <span className="shrink-0 text-xs text-faint">
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded ? (
        <div className="mt-4 space-y-3">
          {route.stops.length > 0 ? (
            <ol className="space-y-2">
              {route.stops.map((stop, i) => {
                const client = byId.get(stop.clientId);
                return (
                  <li
                    key={stop.clientId}
                    className={cn(
                      "rounded-md border border-border bg-surface-2 p-3",
                      stop.done && "opacity-60",
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <button
                        type="button"
                        aria-label={m.routes.markVisited}
                        onClick={() =>
                          patchStops(
                            route.stops.map((s, j) =>
                              j === i ? { ...s, done: !s.done } : s,
                            ),
                          )
                        }
                        className={cn(
                          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                          stop.done
                            ? "border-success bg-success text-white"
                            : "border-border-strong text-muted",
                        )}
                      >
                        {stop.done ? "✓" : i + 1}
                      </button>

                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/${locale}/clients/${stop.clientId}`}
                          className={cn(
                            "block text-sm font-medium hover:text-accent",
                            stop.done && "line-through",
                          )}
                        >
                          {nameOf(stop.clientId)}
                        </Link>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-faint">
                          {client ? <StageChip stage={client.stage} /> : null}
                          {client?.city ? <span>{client.city}</span> : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => move(i, -1)}
                          disabled={i === 0}
                          aria-label={m.routes.moveUp}
                          className="px-1.5 text-xs text-faint disabled:opacity-30 hover:text-fg"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => move(i, 1)}
                          disabled={i === route.stops.length - 1}
                          aria-label={m.routes.moveDown}
                          className="px-1.5 text-xs text-faint disabled:opacity-30 hover:text-fg"
                        >
                          ↓
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          patchStops(route.stops.filter((_, j) => j !== i))
                        }
                        aria-label={m.actions.remove}
                        className="shrink-0 px-1 text-xs text-faint hover:text-critical"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <Input
                        value={stop.addressOverride}
                        onChange={(e) =>
                          patchStops(
                            route.stops.map((s, j) =>
                              j === i
                                ? { ...s, addressOverride: e.target.value }
                                : s,
                            ),
                          )
                        }
                        placeholder={
                          client?.address
                            ? client.address
                            : m.routes.addressPlaceholder
                        }
                        className="h-10 text-xs"
                      />
                      <Input
                        value={stop.note}
                        onChange={(e) =>
                          patchStops(
                            route.stops.map((s, j) =>
                              j === i ? { ...s, note: e.target.value } : s,
                            ),
                          )
                        }
                        placeholder={m.routes.notePlaceholder}
                        className="h-10 text-xs"
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-xs text-faint">{m.routes.addFirst}</p>
          )}

          {/* --- Add a stop ------------------------------------------- */}
          <Select
            value={adding}
            onChange={(e) => {
              setAdding(e.target.value);
              void addStop(e.target.value);
            }}
            className="h-11"
            aria-label={m.routes.addStop}
          >
            <option value="">+ {m.routes.addStop}</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {locale === "ar" && c.nameAr ? c.nameAr : c.name}
                {c.city ? `, ${c.city}` : ""}
              </option>
            ))}
          </Select>

          {/* The map is a choice, not the way routes work. Off by default,
              because a list of names is a perfectly good plan and loading a
              map you did not ask for costs data on a phone in the street. */}
          {mappable.length > 0 ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowMap((v) => !v)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-xs font-medium transition-colors",
                  showMap
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border text-muted hover:text-fg",
                )}
              >
                <span>{showMap ? m.routes.hideMap : m.routes.showMap}</span>
                <span className="text-faint">{showMap ? "▲" : "▼"}</span>
              </button>

              {showMap ? (
                <div className="overflow-hidden rounded-md border border-border">
                  <iframe
                    key={embedUrl}
                    src={embedUrl}
                    title={m.routes.mapTitle}
                    className="block h-64 w-full border-0 sm:h-80"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {mapsUrl ? (
              <a href={mapsUrl} target="_blank" rel="noreferrer">
                <Button variant="primary" size="sm">
                  {m.routes.openInMaps}
                </Button>
              </a>
            ) : null}

            {route.stops.length > 1 ? (
              <Button variant="secondary" size="sm" onClick={groupByArea}>
                {m.routes.groupByArea}
              </Button>
            ) : null}

            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const text = route.stops
                  .map((s, i) => `${i + 1}. ${nameOf(s.clientId)}${
                    byId.get(s.clientId)?.city
                      ? `, ${byId.get(s.clientId)!.city}`
                      : ""
                  }${s.note ? ` (${s.note})` : ""}`)
                  .join("\n");
                await navigator.clipboard.writeText(
                  `${dateLabel}\n${text}`,
                );
              }}
            >
              {m.routes.copyList}
            </Button>

            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                if (!window.confirm(m.actions.removeConfirm)) return;
                await db().deleteRoute(route.id);
                onChanged();
              }}
            >
              {m.actions.remove}
            </Button>
          </div>

          {mappable.length < route.stops.length ? (
            <p className="text-xs text-faint">{m.routes.someUnmapped}</p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
