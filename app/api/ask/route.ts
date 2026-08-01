import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildSnapshot } from "@/lib/ai/snapshot";
import { getMember } from "@/lib/config/members";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { BRAND } from "@/lib/config/brand";
import { ASK_JARVIS_ENABLED } from "@/lib/efficiency";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Overridable, because model names change faster than this codebase will. */
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

/** Enough for a long answer, small enough that a runaway reply cannot bill a fortune. */
const MAX_OUTPUT_TOKENS = 900;

/** How much conversation is carried back. Older turns are dropped. */
const MAX_HISTORY = 12;

interface Turn {
  role: "user" | "assistant";
  content: string;
}

function systemPrompt(memberName: string, snapshot: string): string {
  return `You are ${BRAND.name}, the assistant inside ${BRAND.company}'s internal CRM.

You are talking to ${memberName}, one of the three people who run the agency.
They sell AI services to businesses in Saudi Arabia and spend Sunday, Monday
and Tuesday visiting companies in person.

How to be useful here:
- Answer from the data below. It is their real, current CRM.
- When they ask what to do, be specific and name companies. "Follow up with
  Zahra Trading, 19 days since contact" beats "consider following up".
- Drafting messages is a large part of the job. Write WhatsApp messages,
  follow-up notes and short proposals in the voice of a small, direct agency.
  If the client is Saudi and they have not said otherwise, offer Arabic.
- Never suggest approaching a client marked DO NOT APPROACH, and if they ask
  about one, say plainly that it is closed and why.
- A client owned by another member is not theirs to contact cold. Point them
  at the owner instead.
- If the data does not contain the answer, say so. Do not invent a company, a
  contact, a number or a date. An invented client here sends someone driving
  across the city for nothing.
- Keep it short. They read this on a phone, often standing outside a building.

You cannot change anything in the CRM. If they ask you to log a visit, add a
client or set a reminder, tell them which button does it and offer to draft
the text they would paste.

--- THEIR CRM, RIGHT NOW ---
${snapshot}
--- END ---`;
}

export async function POST(request: Request) {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }

  // The switch is honoured on the server too, so turning it off really does
  // stop the spending rather than only hiding the button.
  if (!ASK_JARVIS_ENABLED) {
    return NextResponse.json({ error: "disabled" }, { status: 503 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key" }, { status: 503 });
  }

  const member = getMember(session.id);
  if (!member) {
    return NextResponse.json({ error: "unknown_member" }, { status: 400 });
  }

  let body: { messages?: Turn[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const history = (body.messages ?? [])
    .filter(
      (t): t is Turn =>
        (t?.role === "user" || t?.role === "assistant") &&
        typeof t?.content === "string" &&
        t.content.trim().length > 0,
    )
    .slice(-MAX_HISTORY)
    .map((t) => ({ role: t.role, content: t.content.slice(0, 4000) }));

  if (!history.length || history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  let snapshot: string;
  try {
    // The snapshot is always built for the session's member, never for an id
    // taken from the request.
    snapshot = await buildSnapshot(session.id);
  } catch {
    snapshot = "(Could not read the CRM just now.)";
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_completion_tokens: MAX_OUTPUT_TOKENS,
        messages: [
          { role: "system", content: systemPrompt(member.name, snapshot) },
          ...history,
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("openai error", res.status, detail.slice(0, 500));
      return NextResponse.json(
        {
          error: "upstream",
          // Surfaced so a wrong model name or an exhausted balance is
          // diagnosable from the screen instead of from the server logs.
          detail: safeMessage(detail),
        },
        { status: 502 },
      );
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return NextResponse.json({ error: "empty_reply" }, { status: 502 });
    }

    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }
}

/** OpenAI's own error text, without leaking anything of ours. */
function safeMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    return (parsed.error?.message ?? "").slice(0, 300);
  } catch {
    return "";
  }
}
