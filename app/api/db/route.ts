import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { SupabaseServerProvider } from "@/lib/data/supabase-server";
import type { DataProvider } from "@/lib/data/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The only door between the browser and the database.
 *
 * The client calls this with an operation name and its arguments; the server
 * verifies the session cookie, then runs the operation with the service_role
 * key. That key never reaches the browser, and every table has RLS on with no
 * policies, so the public anon key cannot be used to go around this.
 *
 * Operations are whitelisted by name. Anything not on the list is refused,
 * so a crafted request cannot reach an arbitrary method.
 */
const ALLOWED = new Set<keyof DataProvider>([
  "listClients",
  "getClient",
  "createClient",
  "updateClient",
  "setStage",
  "setStatus",
  "addCollaborator",
  "requestAccess",
  "listAccessRequests",
  "decideAccess",
  "findPotentialDuplicates",
  "addContact",
  "updateContact",
  "deleteContact",
  "logInteraction",
  "listInteractions",
  "listTasks",
  "createTask",
  "toggleTask",
  "deleteTask",
  "attendanceFor",
  "attendanceToday",
  "setHours",
  "setAttendance",
  "listScheduleDays",
  "decideDay",
  "memberStats",
  "teamStats",
  "listReminders",
  "createReminder",
  "updateReminder",
  "completeReminder",
  "snoozeReminder",
  "deleteReminder",
  "refreshAutoReminders",
  "listRoutes",
  "getRoute",
  "createRoute",
  "updateRoute",
  "deleteRoute",
  "listThreads",
  "listMessages",
  "sendMessage",
  "markThreadRead",
  "getProfile",
  "updateProfile",
  "importClients",
  "importActivity",
  "importTasks",
  "listAudit",
  "exportAll",
  "importAll",
]);

/** One instance per server process — the Supabase client is cheap to reuse. */
let provider: SupabaseServerProvider | null = null;
function getProvider(): SupabaseServerProvider {
  if (!provider) provider = new SupabaseServerProvider();
  return provider;
}

export async function POST(request: Request) {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }

  let body: { op?: string; args?: unknown[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const op = body.op as keyof DataProvider | undefined;
  if (!op || !ALLOWED.has(op)) {
    return NextResponse.json({ error: "unknown_operation" }, { status: 400 });
  }

  try {
    const db = getProvider();
    const fn = db[op] as (...a: unknown[]) => Promise<unknown>;
    const result = await fn.apply(db, body.args ?? []);
    return NextResponse.json({ result: result ?? null });
  } catch (e) {
    // The message is shown to the member — these are things like "a reason is
    // required to mark a client dead", which they need to read.
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** Quick check that the schema exists — used by the setup banner. */
export async function GET() {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }
  try {
    return NextResponse.json(await getProvider().healthCheck());
  } catch (e) {
    return NextResponse.json({
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }
}
