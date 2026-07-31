import "server-only";
import { SupabaseServerProvider } from "@/lib/data/supabase-server";
import { memberName } from "@/lib/config/members";
import { stageDef, statusDef } from "@/lib/config/stages";
import { rangeFor, toDateKey } from "@/lib/dates";

/**
 * What Ask Jarvis is allowed to know.
 *
 * Built fresh on the server for every question, from the signed session's
 * member id. The browser cannot influence whose data goes in, so one member
 * cannot ask the assistant about another member's private view by editing a
 * request. Everyone's clients are visible in the app itself, so the snapshot
 * includes the team's book too, but the "yours" section is always the person
 * who asked.
 *
 * Kept deliberately small. A model reasons better over forty tidy lines than
 * over a database dump, and every line costs money on each question.
 */

const MAX_CLIENTS = 40;
const MAX_ACTIVITY = 30;

export async function buildSnapshot(memberId: string): Promise<string> {
  const db = new SupabaseServerProvider();
  const today = new Date();
  const month = rangeFor("month");

  const [clients, activity, tasks, routes] = await Promise.all([
    db.listClients({}),
    db.listInteractions({ memberId, range: month, limit: MAX_ACTIVITY }),
    db.listTasks({ assigneeId: memberId }),
    db.listRoutes(memberId, { from: toDateKey(today) }),
  ]);

  const mine = clients.filter(
    (c) => c.ownerId === memberId || c.collaboratorIds.includes(memberId),
  );
  const theirs = clients.filter((c) => !mine.includes(c));
  const openTasks = tasks.filter((t) => t.status === "open");

  const lines: string[] = [];
  const push = (s: string) => lines.push(s);

  push(`Today is ${today.toISOString().slice(0, 10)} (Asia/Riyadh).`);
  push(`You are talking to ${memberName(memberId)}.`);
  push("");

  push(`## ${memberName(memberId)}'s clients (${mine.length})`);
  if (!mine.length) {
    push("None yet. They have not added any clients to the system.");
  }
  for (const c of mine.slice(0, MAX_CLIENTS)) {
    push(clientLine(c));
  }
  push("");

  if (theirs.length) {
    push(`## The other two members' clients (${theirs.length})`);
    push("Visible to everyone. Do not suggest approaching these directly.");
    for (const c of theirs.slice(0, MAX_CLIENTS)) {
      push(`${clientLine(c)} [owner: ${memberName(c.ownerId)}]`);
    }
    push("");
  }

  push(`## What ${memberName(memberId)} has logged this month`);
  if (!activity.length) push("Nothing logged.");
  for (const i of activity) {
    const client = clients.find((c) => c.id === i.clientId);
    push(
      `- ${i.happenedAt.slice(0, 16).replace("T", " ")} ${i.type} ` +
        `${client?.name ?? "unknown client"}: ${i.summary}`,
    );
  }
  push("");

  push(`## Open tasks (${openTasks.length})`);
  for (const t of openTasks.slice(0, 20)) {
    const client = clients.find((c) => c.id === t.clientId);
    push(
      `- ${t.title}` +
        (client ? ` (${client.name})` : "") +
        (t.dueAt ? ` due ${t.dueAt.slice(0, 10)}` : "") +
        (t.priority === "high" ? " [high priority]" : ""),
    );
  }
  if (!openTasks.length) push("None.");
  push("");

  if (routes.length) {
    push("## Planned routes");
    for (const r of routes.slice(0, 5)) {
      const names = r.stops
        .map((s) => clients.find((c) => c.id === s.clientId)?.name ?? "?")
        .join(", ");
      push(`- ${r.date}: ${names || "no stops yet"}`);
    }
  }

  return lines.join("\n");
}

function clientLine(c: {
  name: string;
  city: string;
  stage: string;
  status: string;
  daysSinceContact: number | null;
  isStale: boolean;
  nextAction: string;
  closedReason: string;
}): string {
  const bits = [
    `- ${c.name}`,
    c.city ? `(${c.city})` : "",
    `stage: ${stageDef(c.stage as never).label}`,
    `status: ${statusDef(c.status as never).label}`,
    c.daysSinceContact === null
      ? "never contacted"
      : `last contact ${c.daysSinceContact}d ago`,
    c.isStale ? "GOING COLD" : "",
    c.nextAction ? `next: ${c.nextAction}` : "",
    c.status === "dead" && c.closedReason
      ? `DO NOT APPROACH: ${c.closedReason}`
      : "",
  ];
  return bits.filter(Boolean).join(" · ");
}
