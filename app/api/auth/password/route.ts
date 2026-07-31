import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getMember } from "@/lib/config/members";
import { verifyPassword } from "@/lib/auth/password";
import { hashPassword, writePasswordHash } from "@/lib/auth/store";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

// scrypt needs the Node runtime.
export const runtime = "nodejs";

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Change your own password. Yours only: the member is taken from the signed
 * session cookie, never from the request body, so this endpoint cannot be
 * pointed at somebody else's account.
 */
export async function POST(request: Request) {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }

  const member = getMember(session.id);
  if (!member) {
    return NextResponse.json({ error: "unknown_member" }, { status: 400 });
  }

  let body: { current?: string; next?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const next = body.next ?? "";
  if (next.trim().length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: "too_short" }, { status: 400 });
  }

  if (!(await verifyPassword(member, body.current ?? ""))) {
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "wrong_password" }, { status: 401 });
  }

  const saved = await writePasswordHash(member.id, hashPassword(next));
  if (!saved) {
    return NextResponse.json({ error: "not_saved" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
