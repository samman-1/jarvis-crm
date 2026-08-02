"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/primitives";
import type { ClientRow, RouteStop } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Our own map of the day, drawn here rather than embedded from Google.
 *
 * OpenStreetMap tiles underneath, our own markers and arrows on top. That
 * means we control what it shows: the stops are numbered in the order you
 * intend to drive them and joined by arrows pointing the way you are going,
 * which an embedded directions map cannot express.
 *
 * Coordinates are looked up once per company and kept on the client record,
 * so opening this a second time draws instantly.
 */

const TILE = 256;

/** Web Mercator, the projection every slippy map uses. */
function project(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x: x * TILE, y: y * TILE };
}

interface Point {
  id: string;
  name: string;
  lat: number;
  lng: number;
  done: boolean;
}

export function RouteMap({
  stops,
  clients,
  locale,
  width = 340,
  height = 300,
}: {
  stops: RouteStop[];
  clients: ClientRow[];
  locale: "en" | "ar";
  width?: number;
  height?: number;
}) {
  const { m } = useI18n();
  const [coords, setCoords] = useState<Record<string, [number, number]>>({});
  const [locating, setLocating] = useState(false);
  const [failed, setFailed] = useState(false);

  const byId = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients],
  );

  /* Stops we can already draw, in the order you intend to drive them. */
  const points = useMemo<Point[]>(() => {
    const out: Point[] = [];
    stops.forEach((s) => {
      const c = byId.get(s.clientId);
      const extra = coords[s.clientId];
      const lat = c?.lat ?? extra?.[0] ?? null;
      const lng = c?.lng ?? extra?.[1] ?? null;
      if (lat === null || lng === null) return;
      out.push({
        id: s.clientId,
        name: c
          ? locale === "ar" && c.nameAr
            ? c.nameAr
            : c.name
          : (s.label ?? ""),
        lat,
        lng,
        done: s.done,
      });
    });
    return out;
  }, [stops, byId, coords, locale]);

  const missing = useMemo(
    () =>
      stops
        .map((s) => s.clientId)
        .filter(
          (id) =>
            id &&
            !coords[id] &&
            (byId.get(id)?.lat === null || byId.get(id)?.lat === undefined),
        ),
    [stops, byId, coords],
  );

  /* Look up anything we do not have yet, once, when the map opens. */
  useEffect(() => {
    if (!missing.length || locating || failed) return;
    let cancelled = false;
    setLocating(true);
    fetch("/api/geocode", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: missing }),
    })
      .then((r) => r.json())
      .then((data: { located?: { id: string; lat: number; lng: number }[] }) => {
        if (cancelled) return;
        const next: Record<string, [number, number]> = {};
        for (const hit of data.located ?? []) {
          if (hit.lat !== null && hit.lng !== null) next[hit.id] = [hit.lat, hit.lng];
        }
        setCoords((prev) => ({ ...prev, ...next }));
        if (!Object.keys(next).length) setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLocating(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing.join(",")]);

  /* Frame everything with a margin, at the tightest zoom that still fits. */
  const view = useMemo(() => {
    if (points.length === 0) return null;
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const pad = 0.02;
    const minLat = Math.min(...lats) - pad;
    const maxLat = Math.max(...lats) + pad;
    const minLng = Math.min(...lngs) - pad;
    const maxLng = Math.max(...lngs) + pad;

    let zoom = 16;
    for (; zoom > 3; zoom--) {
      const a = project(maxLat, minLng, zoom);
      const b = project(minLat, maxLng, zoom);
      if (b.x - a.x <= width && b.y - a.y <= height) break;
    }
    const centre = project((minLat + maxLat) / 2, (minLng + maxLng) / 2, zoom);
    return {
      zoom,
      left: centre.x - width / 2,
      top: centre.y - height / 2,
    };
  }, [points, width, height]);

  if (points.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border text-center"
        style={{ height }}
      >
        {locating ? (
          <>
            <span className="size-2 animate-live rounded-full bg-accent" />
            <p className="text-xs text-faint">{m.routes.locating}</p>
          </>
        ) : (
          <p className="max-w-56 text-xs leading-relaxed text-faint">
            {m.routes.cannotLocate}
          </p>
        )}
      </div>
    );
  }

  const { zoom, left, top } = view!;
  const screen = points.map((p) => {
    const q = project(p.lat, p.lng, zoom);
    return { ...p, sx: q.x - left, sy: q.y - top };
  });

  /* The tiles covering the window, as a plain grid of images. */
  const x0 = Math.floor(left / TILE);
  const y0 = Math.floor(top / TILE);
  const x1 = Math.floor((left + width) / TILE);
  const y1 = Math.floor((top + height) / TILE);
  const tiles: { key: string; src: string; dx: number; dy: number }[] = [];
  const n = 2 ** zoom;
  for (let tx = x0; tx <= x1; tx++) {
    for (let ty = y0; ty <= y1; ty++) {
      const wrapped = ((tx % n) + n) % n;
      if (ty < 0 || ty >= n) continue;
      tiles.push({
        key: `${tx}-${ty}`,
        src: `https://tile.openstreetmap.org/${zoom}/${wrapped}/${ty}.png`,
        dx: tx * TILE - left,
        dy: ty * TILE - top,
      });
    }
  }

  return (
    <div className="space-y-2">
      <div
        className="relative overflow-hidden rounded-md border border-border bg-surface-2"
        style={{ width: "100%", height }}
      >
        <div className="absolute inset-0" style={{ width, height }}>
          {tiles.map((t) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={t.key}
              src={t.src}
              alt=""
              width={TILE}
              height={TILE}
              loading="eager"
              className="absolute select-none"
              style={{ left: t.dx, top: t.dy }}
              draggable={false}
            />
          ))}

          {/* Everything above this line is ours. */}
          <svg
            className="absolute inset-0"
            width={width}
            height={height}
            style={{ pointerEvents: "none" }}
          >
            <defs>
              <marker
                id="jarvis-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
              </marker>
            </defs>

            {/* One arrow per leg, pointing the way you are driving. */}
            {screen.slice(0, -1).map((p, i) => {
              const q = screen[i + 1];
              // Stop short of the marker so the head is not hidden under it.
              const dx = q.sx - p.sx;
              const dy = q.sy - p.sy;
              const len = Math.hypot(dx, dy) || 1;
              const trim = 16;
              return (
                <line
                  key={`${p.id}-${q.id}`}
                  x1={p.sx + (dx / len) * trim}
                  y1={p.sy + (dy / len) * trim}
                  x2={q.sx - (dx / len) * trim}
                  y2={q.sy - (dy / len) * trim}
                  stroke="var(--accent)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  markerEnd="url(#jarvis-arrow)"
                  opacity="0.9"
                />
              );
            })}

            {screen.map((p, i) => (
              <g key={p.id}>
                <circle
                  cx={p.sx}
                  cy={p.sy}
                  r="13"
                  fill={p.done ? "var(--success)" : "var(--accent)"}
                  stroke="#fff"
                  strokeWidth="2.5"
                />
                <text
                  x={p.sx}
                  y={p.sy + 4}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="700"
                  fill="#fff"
                >
                  {p.done ? "✓" : i + 1}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* OSM asks for attribution wherever their tiles are shown. */}
        <span className="absolute end-0 bottom-0 bg-bg/70 px-1 text-[9px] text-faint">
          © OpenStreetMap
        </span>
      </div>

      {locating ? (
        <p className="text-[11px] text-faint">{m.routes.locating}</p>
      ) : missing.length > 0 ? (
        <p className="text-[11px] text-faint">
          {m.routes.someUnlocated.replace("{n}", String(missing.length))}
        </p>
      ) : null}
    </div>
  );
}
