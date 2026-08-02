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
import { RouteMap } from "@/components/routes/route-map";
import { memberLabel } from "@/lib/config/members";
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
            memberId={user.id}
            onClientCreated={clients.reload}
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
  memberId,
  onClientCreated,
  m,
}: {
  route: DayRoute;
  clients: ClientRow[];
  locale: Locale;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
  memberId: string;
  onClientCreated: () => void;
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

  /** What to show for a stop, client-backed or not. */
  const stopName = (stop: RouteStop) =>
    stop.clientId ? nameOf(stop.clientId) : (stop.label ?? "");

  /**
   * What Google Maps should search for.
   *
   * The company field holds the official name where we have one, and that is
   * what Maps can actually find: our own shorthand ("Sabqoon") geocodes to
   * nothing, and one unfindable stop makes Google give up on the whole route
   * and draw the entire planet.
   */
  const queryFor = (stop: RouteStop) => {
    if (stop.addressOverride.trim()) return stop.addressOverride.trim();
    const c = byId.get(stop.clientId);
    if (c) return [c.address, c.company || c.name, c.city].filter(Boolean).join(", ");
    // No client behind it is fine: the label is the search, which is how
    // anyone would look the place up in Maps anyway.
    return (stop.label ?? "").trim();
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

  /** Somewhere worth going that is not a client and does not need to be. */
  async function addPlainStop(label: string) {
    const name = label.trim();
    if (!name) return;
    await patchStops([
      ...route.stops,
      { clientId: "", label: name, addressOverride: "", note: "", done: false },
    ]);
  }

  /**
   * Put it on the day and claim it at the same time.
   *
   * This is the point of the whole system: the moment a company is on your
   * route it is yours, so the other two get the "already owned by" warning
   * instead of driving out to the same door next week. Making that a separate
   * trip to the new-client form is how it gets skipped.
   */
  async function createClientStop(name: string, city: string) {
    const created = await db().createClient(
      {
        name: name.trim(),
        city: city.trim(),
        stage: "lead",
        status: "active",
        ownerId: memberId,
        broughtById: memberId,
        source: "Route planning",
      },
      memberId,
    );
    await patchStops([
      ...route.stops,
      { clientId: created.id, addressOverride: "", note: "", done: false },
    ]);
    onClientCreated();
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

  /*
   * The city everything else on this day is in.
   *
   * A stop with no city is the difference between a map of Riyadh and a map
   * of the planet: Google cannot place "the industrial estate off Exit 18" on
   * its own, zooms out to the whole world, and the map becomes useless. So a
   * new stop inherits the day's city, and you only change it when it differs.
   */
  const defaultCity = useMemo(() => {
    const counts = new Map<string, number>();
    for (const stop of route.stops) {
      const city = byId.get(stop.clientId)?.city?.trim();
      if (city) counts.set(city, (counts.get(city) ?? 0) + 1);
    }
    if (counts.size === 0) {
      for (const c of clients) {
        if (c.city.trim()) counts.set(c.city, (counts.get(c.city) ?? 0) + 1);
      }
    }
    let best = "";
    let top = 0;
    for (const [city, n] of counts) {
      if (n > top) {
        top = n;
        best = city;
      }
    }
    return best;
  }, [route.stops, byId, clients]);

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
                    key={stop.clientId || `plain-${i}`}
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
                        {stop.clientId ? (
                          <Link
                            href={`/${locale}/clients/${stop.clientId}`}
                            className={cn(
                              "block text-sm font-medium hover:text-accent",
                              stop.done && "line-through",
                            )}
                          >
                            {stopName(stop)}
                          </Link>
                        ) : (
                          <span
                            className={cn(
                              "block text-sm font-medium",
                              stop.done && "line-through",
                            )}
                          >
                            {stopName(stop)}
                          </span>
                        )}
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-faint">
                          {client ? <StageChip stage={client.stage} /> : null}
                          {client?.city ? <span>{client.city}</span> : null}
                          {!stop.clientId ? (
                            <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px]">
                              {m.routes.notAClient}
                            </span>
                          ) : null}
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
          <AddStop
            available={available}
            allClients={clients}
            defaultCity={defaultCity}
            locale={locale}
            m={m}
            onPickClient={addStop}
            onAddPlain={addPlainStop}
            onCreateClient={createClientStop}
          />

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
                <RouteMap
                  stops={route.stops}
                  clients={clients}
                  locale={locale === "ar" ? "ar" : "en"}
                />
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
                  .map((s, i) => `${i + 1}. ${stopName(s)}${
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

/* ------------------------------------------------------------------ */

/**
 * Adding somewhere to the day.
 *
 * The old version was a dropdown of your own clients, which meant a company
 * you had not entered yet could not go on a route at all — so you planned the
 * day in your head instead, and nobody else ever learned you were going.
 *
 * Type a name and it offers whatever fits:
 *   · one of the companies already in the system, yours or anyone's
 *   · a new client, created and owned by you on the spot
 *   · a plain stop, for a place that is not a company you are selling to
 *
 * The collision warning is the important part. If one of the others already
 * owns that name it says so before you add it, because two people arriving at
 * the same door in one week is the exact thing this system exists to stop.
 */
function AddStop({
  available,
  allClients,
  defaultCity,
  locale,
  m,
  onPickClient,
  onAddPlain,
  onCreateClient,
}: {
  available: ClientRow[];
  allClients: ClientRow[];
  /** Prefilled so a new stop lands in the right city without being typed. */
  defaultCity: string;
  locale: Locale;
  m: ReturnType<typeof useI18n>["m"];
  onPickClient: (id: string) => Promise<void>;
  onAddPlain: (label: string) => Promise<void>;
  onCreateClient: (name: string, city: string) => Promise<void>;
}) {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState(defaultCity);
  const [busy, setBusy] = useState(false);

  const q = query.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!q) return available.slice(0, 6);
    return available
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.nameAr.includes(query.trim()) ||
          c.city.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [available, q, query]);

  /* Anyone else's client with this name, including ones closed for good. The
     dead list matters most here: that is a wasted morning. */
  const clash = useMemo(() => {
    if (q.length < 3) return null;
    return (
      allClients.find(
        (c) =>
          c.ownerId !== user.id &&
          !c.collaboratorIds.includes(user.id) &&
          c.name.toLowerCase().includes(q),
      ) ?? null
    );
  }, [allClients, q, user.id]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      setQuery("");
      setCity(defaultCity);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button
        variant="secondary"
        className="w-full"
        onClick={() => {
          // Read the day's city here, not in useState. The picker mounts
          // while the route is still empty, so the initial value is always
          // blank and never catches up on its own.
          setCity(defaultCity);
          setOpen(true);
        }}
      >
        + {m.routes.addStop}
      </Button>
    );
  }

  return (
    <div className="animate-enter space-y-2.5 rounded-md border border-border bg-surface-2 p-3">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={m.routes.searchOrType}
        aria-label={m.routes.searchOrType}
        className="h-11"
        autoFocus
      />

      {clash ? (
        <div
          className={cn(
            "rounded-md border p-2.5 text-xs leading-relaxed",
            clash.status === "dead"
              ? "border-critical bg-critical-soft"
              : "border-warn bg-warn-soft",
          )}
        >
          {clash.status === "dead" ? (
            <>
              <strong>⛔ {clash.name}</strong> {m.duplicate.deadBy}{" "}
              <strong>{memberLabel(clash.closedById)}</strong>.{" "}
              {clash.closedReason}
            </>
          ) : (
            <>
              <strong>{clash.name}</strong> {m.duplicate.ownedBy}{" "}
              <strong>{memberLabel(clash.ownerId)}</strong>.{" "}
              {m.routes.askThemFirst}
            </>
          )}
        </div>
      ) : null}

      {matches.length > 0 ? (
        <ul className="space-y-1">
          {matches.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => onPickClient(c.id))}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-start text-sm transition-colors hover:bg-surface-3 disabled:opacity-50"
              >
                <span className="min-w-0 flex-1 truncate">
                  {locale === "ar" && c.nameAr ? c.nameAr : c.name}
                </span>
                {c.city ? (
                  <span className="shrink-0 text-[11px] text-faint">
                    {c.city}
                  </span>
                ) : null}
                {c.ownerId !== user.id ? (
                  <span className="shrink-0 text-[11px] text-warn">
                    {memberLabel(c.ownerId)}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Nothing matched, so decide what this name is. */}
      {q.length >= 2 && !matches.some((c) => c.name.toLowerCase() === q) ? (
        <div className="space-y-2 border-t border-border pt-2.5">
          <p className="text-[11px] text-faint">{m.routes.notInSystem}</p>
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={m.newClient.city}
            aria-label={m.newClient.city}
            className="h-10 text-xs"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() => void run(() => onCreateClient(query, city))}
            >
              {busy ? m.common.saving : m.routes.addAsClient}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  onAddPlain(city.trim() ? `${query.trim()}, ${city.trim()}` : query),
                )
              }
            >
              {m.routes.addAsPlain}
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-faint">
            {m.routes.addAsClientHint}
          </p>
        </div>
      ) : null}

      <Button
        variant="ghost"
        size="sm"
        className="w-full"
        onClick={() => {
          setOpen(false);
          setQuery("");
          setCity(defaultCity);
        }}
      >
        {m.common.cancel}
      </Button>
    </div>
  );
}
