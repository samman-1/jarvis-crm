import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { SupabaseServerProvider } from "@/lib/data/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Turn company names into coordinates, once, and keep them.
 *
 * Needed because we draw the route map ourselves now rather than handing the
 * whole thing to an embedded Google map. Uses OpenStreetMap's Nominatim: free,
 * no key, no billing. Its terms ask for a real User-Agent and no more than one
 * request a second, so this looks up a handful of stops at a time and pauses
 * between them.
 *
 * The answer is written to the client row, so a company is geocoded once and
 * every future route reuses it.
 */

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const AGENT = "JarvisCRM/1.0 (internal tool; crm.jarvisksa.com)";
/** Their policy is one request a second. Stay under it. */
const GAP_MS = 1200;
/** One tap should not fire fifty lookups. */
const MAX_PER_CALL = 12;

interface Hit {
  id: string;
  lat: number | null;
  lng: number | null;
}

async function lookup(query: string): Promise<[number, number] | null> {
  const url =
    `${NOMINATIM}?format=json&limit=1&countrycodes=sa&q=` +
    encodeURIComponent(query);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": AGENT, "Accept-Language": "en" },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { lat: string; lon: string }[];
    if (!rows.length) return null;
    const lat = Number(rows[0].lat);
    const lng = Number(rows[0].lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }

  let body: { ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const ids = (body.ids ?? []).filter(Boolean).slice(0, MAX_PER_CALL);
  if (!ids.length) return NextResponse.json({ located: [] as Hit[] });

  const db = new SupabaseServerProvider();
  const clients = await db.listClients({});
  const located: Hit[] = [];

  for (const id of ids) {
    const c = clients.find((x) => x.id === id);
    if (!c || (c.lat !== null && c.lng !== null)) continue;

    // The official name is what Nominatim can find; our shorthand is not.
    const query = [c.address, c.company || c.name, c.city || "Jeddah", "Saudi Arabia"]
      .filter(Boolean)
      .join(", ");

    const hit = await lookup(query);
    // Falling back to the city keeps the stop on the map rather than dropping
    // it: roughly right beats absent when you are deciding a driving order.
    const point = hit ?? (await lookup(`${c.city || "Jeddah"}, Saudi Arabia`));

    if (point) {
      await db.updateClient(id, { lat: point[0], lng: point[1] }, session.id);
      located.push({ id, lat: point[0], lng: point[1] });
    } else {
      located.push({ id, lat: null, lng: null });
    }
    await new Promise((r) => setTimeout(r, GAP_MS));
  }

  return NextResponse.json({ located });
}
