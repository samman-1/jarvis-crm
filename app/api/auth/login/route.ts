import { NextResponse } from "next/server";
import { getMemberBySlot } from "@/lib/config/members";
import { verifyPassword } from "@/lib/auth/password";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
} from "@/lib/auth/session";

// scrypt needs the Node runtime.
export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { slot?: number; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const member = getMemberBySlot(Number(body.slot));
  if (!member) {
    return NextResponse.json({ error: "unknown_member" }, { status: 400 });
  }

  if (!verifyPassword(member, body.password ?? "")) {
    // Deliberately slow the failure path a little so the login tile cannot be
    // hammered at full speed from a script.
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "wrong_password" }, { status: 401 });
  }

  const token = await signSession({
    id: member.id,
    slot: member.slot,
    name: member.name,
  });

  const response = NextResponse.json({
    ok: true,
    member: { id: member.id, slot: member.slot, name: member.name },
  });

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return response;
}
