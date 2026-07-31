"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSession } from "@/components/providers/session-provider";
import { useAsync, useMounted } from "@/lib/hooks/use-async";
import { db } from "@/lib/data";
import {
  Button,
  Card,
  CardHeader,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { PageHeader } from "@/components/shell/page-header";
import { parseActivity, parseClients } from "@/lib/import/parse";
import {
  INTERACTION_TYPES,
  STAGES,
  STATUSES,
  type ClientStatus,
  type InteractionType,
  type Stage,
} from "@/lib/config/stages";
import { PUBLIC_MEMBERS } from "@/lib/config/members";
import type { ParsedActivityRow, ParsedClientRow } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

type Mode = "clients" | "activity";

const CLIENT_EXAMPLE = `Al-Faisal Trading - walked in, met Ahmed the ops manager, he asked for a quote
Zad Restaurant - DEAD, owner shouted at us and said don't come back
Hala Beauty - sent the profile on whatsapp, waiting
Gulf Fresh Markets, Suwaidi - just spotted them, haven't gone in yet`;

const ACTIVITY_EXAMPLE = `Sunday
- 09:20 Areej Perfumes, walked in, owner not there
- 11:00 Called Barakah about the scoping document

Tuesday
- 10:30 Nakheel Dental, meeting with Dr Reem, she wants a pilot
- Sent Noor Academy the proposal`;

/**
 * Chosen in the client dropdown to mean "this company is not in the system
 * yet, make it". Never reaches the database; it is swapped for a real id.
 */
const NEW_CLIENT = "__new__";

/**
 * Paste a whole day — or a whole backlog — in one message.
 *
 * Typing companies in one at a time is what stops people using a CRM at all.
 * This takes whatever was written in WhatsApp, guesses the structure, and then
 * asks for confirmation. Nothing is written until the table is approved, so a
 * bad guess costs a tap rather than a wrong record.
 */
export function BulkImport({
  locale,
  initialMode = "clients",
}: {
  locale: Locale;
  /** Set from the link you arrived on, so "what I did" opens ready to paste. */
  initialMode?: Mode;
}) {
  const { m } = useI18n();
  const { user } = useSession();
  const router = useRouter();
  const mounted = useMounted();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [text, setText] = useState("");
  const [clientRows, setClientRows] = useState<ParsedClientRow[] | null>(null);
  const [activityRows, setActivityRows] = useState<ParsedActivityRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  const existing = useAsync(
    () => (mounted ? db().listClients() : Promise.resolve([])),
    [mounted],
  );

  function readIt() {
    const clients = existing.data ?? [];
    if (mode === "clients") {
      setClientRows(parseClients(text, clients));
      setActivityRows(null);
    } else {
      setActivityRows(parseActivity(text, clients));
      setClientRows(null);
    }
  }

  function reset() {
    setText("");
    setClientRows(null);
    setActivityRows(null);
    setResult("");
  }

  async function saveClients() {
    if (!clientRows) return;
    setBusy(true);
    try {
      const out = await db().importClients(clientRows, user.id);
      setResult(
        `${out.created} ${m.importer.added}` +
          (out.joined ? ` · ${out.joined} ${m.importer.joined}` : "") +
          (out.skipped ? ` · ${out.skipped} ${m.importer.skipped}` : ""),
      );
      setClientRows(null);
      setText("");
      existing.reload();
    } finally {
      setBusy(false);
    }
  }

  /**
   * Save the day, creating any company that does not exist yet.
   *
   * Without this, pasting a week of visits into an empty system saves nothing:
   * every line needs a client, and every client would have to be typed in by
   * hand first. Rows marked NEW create the company from the name the parser
   * read, then log against it, so one paste is genuinely one action.
   */
  async function saveActivity() {
    if (!activityRows) return;
    setBusy(true);
    try {
      const rows = [...activityRows];
      let created = 0;

      // Same company on three lines should become one client, not three.
      const madeByName = new Map<string, string>();
      for (const row of rows) {
        if (row.clientId !== NEW_CLIENT || !row.include) continue;
        const name = row.clientGuess.trim();
        if (!name) continue;

        const key = name.toLowerCase();
        let id = madeByName.get(key);
        if (!id) {
          const client = await db().createClient(
            {
              name,
              stage: "contacted",
              status: "active",
              ownerId: user.id,
              broughtById: user.id,
            },
            user.id,
          );
          id = client.id;
          madeByName.set(key, id);
          created++;
        }
        row.clientId = id;
      }

      const out = await db().importActivity(rows, user.id);
      setResult(
        `${out.created} ${m.importer.logged}` +
          (created ? ` · ${created} ${m.importer.added}` : ""),
      );
      setActivityRows(null);
      setText("");
      if (created) existing.reload();
    } finally {
      setBusy(false);
    }
  }

  const clients = existing.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title={m.importer.title} subtitle={m.importer.subtitle} />

      {/* --- What am I pasting? --------------------------------------- */}
      <div className="flex overflow-hidden rounded-md border border-border">
        {(["clients", "activity"] as Mode[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => {
              setMode(v);
              reset();
            }}
            className={cn(
              "flex-1 px-4 py-3 text-sm font-medium transition-colors",
              mode === v ? "bg-accent-soft text-accent" : "text-muted hover:text-fg",
            )}
          >
            {v === "clients" ? m.importer.modeClients : m.importer.modeActivity}
          </button>
        ))}
      </div>

      {result ? (
        <div className="rounded-lg border border-success bg-success-soft p-3.5 text-sm">
          ✓ {result}
        </div>
      ) : null}

      {!clientRows && !activityRows ? (
        <Card>
          <CardHeader
            title={m.importer.pasteTitle}
            hint={
              mode === "clients" ? m.importer.pasteHintClients : m.importer.pasteHintActivity
            }
          />
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={mode === "clients" ? CLIENT_EXAMPLE : ACTIVITY_EXAMPLE}
            className="min-h-56 font-mono text-xs leading-relaxed"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" onClick={readIt} disabled={!text.trim()}>
              {m.importer.read}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setText(mode === "clients" ? CLIENT_EXAMPLE : ACTIVITY_EXAMPLE)}
            >
              {m.importer.useExample}
            </Button>
          </div>
        </Card>
      ) : null}

      {/* --- Client preview -------------------------------------------- */}
      {clientRows ? (
        <Card>
          <CardHeader
            title={m.importer.checkTitle}
            hint={`${clientRows.filter((r) => r.include).length} / ${clientRows.length} ${m.importer.willBeSaved}`}
            action={
              <Button size="sm" variant="ghost" onClick={reset}>
                {m.common.cancel}
              </Button>
            }
          />

          <div className="space-y-3">
            {clientRows.map((row, i) => (
              <div
                key={row.id}
                className={cn(
                  "rounded-md border p-3",
                  row.include ? "border-border bg-surface-2" : "border-dashed border-border opacity-50",
                  row.duplicateOf?.status === "dead" && "border-critical bg-critical-soft",
                )}
              >
                <div className="mb-2 flex items-start gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setClientRows((rows) =>
                        rows!.map((r, j) => (j === i ? { ...r, include: !r.include } : r)),
                      )
                    }
                    aria-label={m.importer.include}
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm border text-xs",
                      row.include
                        ? "border-accent bg-accent text-accent-fg"
                        : "border-border-strong",
                    )}
                  >
                    {row.include ? "✓" : ""}
                  </button>
                  <Input
                    value={row.name}
                    onChange={(e) =>
                      setClientRows((rows) =>
                        rows!.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)),
                      )
                    }
                    className="h-10 flex-1 font-medium"
                  />
                </div>

                {/* The whole reason this system exists — say it loudly. */}
                {row.duplicateOf ? (
                  <p
                    className="mb-2 rounded-sm px-2.5 py-2 text-xs leading-relaxed"
                    style={{
                      backgroundColor:
                        row.duplicateOf.status === "dead"
                          ? "var(--critical-soft)"
                          : "var(--warn-soft)",
                      color:
                        row.duplicateOf.status === "dead"
                          ? "var(--critical)"
                          : "var(--warn)",
                    }}
                  >
                    {row.duplicateOf.status === "dead" ? "⛔ " : "⚠ "}
                    {row.duplicateOf.status === "dead"
                      ? m.importer.dupDead
                      : m.importer.dupOwned}{" "}
                    <strong>
                      {(() => {
                        const p = PUBLIC_MEMBERS.find(
                          (x) => x.id === row.duplicateOf!.ownerId,
                        );
                        return p ? (locale === "ar" ? p.nameAr : p.name) : "";
                      })()}
                    </strong>
                    {row.duplicateOf.status !== "dead" ? `, ${m.importer.dupJoin}` : ""}
                  </p>
                ) : null}

                <Textarea
                  value={row.whatHappened}
                  onChange={(e) =>
                    setClientRows((rows) =>
                      rows!.map((r, j) =>
                        j === i ? { ...r, whatHappened: e.target.value } : r,
                      ),
                    )
                  }
                  placeholder={m.client.whatHappened}
                  className="min-h-14 text-xs"
                />

                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <Select
                    value={row.stage}
                    onChange={(e) =>
                      setClientRows((rows) =>
                        rows!.map((r, j) =>
                          j === i ? { ...r, stage: e.target.value as Stage } : r,
                        ),
                      )
                    }
                    className="h-10 text-xs"
                  >
                    {STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {locale === "ar" ? s.labelAr : s.label}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={row.status}
                    onChange={(e) =>
                      setClientRows((rows) =>
                        rows!.map((r, j) =>
                          j === i ? { ...r, status: e.target.value as ClientStatus } : r,
                        ),
                      )
                    }
                    className={cn(
                      "h-10 text-xs",
                      row.status === "dead" && "border-critical text-critical",
                    )}
                  >
                    {STATUSES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {locale === "ar" ? s.labelAr : s.label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    value={row.contactPhone}
                    onChange={(e) =>
                      setClientRows((rows) =>
                        rows!.map((r, j) =>
                          j === i ? { ...r, contactPhone: e.target.value } : r,
                        ),
                      )
                    }
                    placeholder={m.actions.contactPhone}
                    className="h-10 text-xs"
                    dir="ltr"
                  />
                </div>

                {row.status === "dead" ? (
                  <Textarea
                    value={row.closedReason}
                    onChange={(e) =>
                      setClientRows((rows) =>
                        rows!.map((r, j) =>
                          j === i ? { ...r, closedReason: e.target.value } : r,
                        ),
                      )
                    }
                    placeholder={m.client.deadReasonLabel}
                    className="mt-2 min-h-14 border-critical text-xs"
                  />
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" onClick={saveClients} disabled={busy}>
              {busy
                ? m.common.saving
                : `${m.importer.saveAll} (${clientRows.filter((r) => r.include).length})`}
            </Button>
            <Button variant="ghost" onClick={reset}>
              {m.common.cancel}
            </Button>
          </div>
        </Card>
      ) : null}

      {/* --- Activity preview ------------------------------------------ */}
      {activityRows ? (
        <Card>
          <CardHeader
            title={m.importer.checkTitle}
            hint={m.importer.activityHint}
            action={
              <Button size="sm" variant="ghost" onClick={reset}>
                {m.common.cancel}
              </Button>
            }
          />

          <div className="space-y-2">
            {activityRows.map((row, i) => (
              <div
                key={row.id}
                className={cn(
                  "rounded-md border p-3",
                  row.clientId ? "border-border bg-surface-2" : "border-warn bg-warn-soft",
                  !row.include && "opacity-50",
                )}
              >
                <div className="flex items-start gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setActivityRows((rows) =>
                        rows!.map((r, j) => (j === i ? { ...r, include: !r.include } : r)),
                      )
                    }
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm border text-xs",
                      row.include ? "border-accent bg-accent text-accent-fg" : "border-border-strong",
                    )}
                  >
                    {row.include ? "✓" : ""}
                  </button>
                  <p className="min-w-0 flex-1 text-sm">{row.summary}</p>
                </div>

                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  <Select
                    value={row.clientId}
                    onChange={(e) =>
                      setActivityRows((rows) =>
                        rows!.map((r, j) =>
                          j === i ? { ...r, clientId: e.target.value } : r,
                        ),
                      )
                    }
                    className={cn("h-10 text-xs", !row.clientId && "border-warn")}
                  >
                    <option value="">
                      {m.importer.whichClient}
                      {row.clientGuess ? `: "${row.clientGuess}"?` : ""}
                    </option>
                    {row.clientGuess.trim() ? (
                      <option value={NEW_CLIENT}>
                        + {m.importer.createNamed} "{row.clientGuess.trim()}"
                      </option>
                    ) : null}
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {locale === "ar" && c.nameAr ? c.nameAr : c.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={row.type}
                    onChange={(e) =>
                      setActivityRows((rows) =>
                        rows!.map((r, j) =>
                          j === i ? { ...r, type: e.target.value as InteractionType } : r,
                        ),
                      )
                    }
                    className="h-10 text-xs"
                  >
                    {INTERACTION_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {locale === "ar" ? t.labelAr : t.label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="date"
                    value={row.date}
                    onChange={(e) =>
                      setActivityRows((rows) =>
                        rows!.map((r, j) => (j === i ? { ...r, date: e.target.value } : r)),
                      )
                    }
                    className="h-10 text-xs"
                    dir="ltr"
                  />
                  <Input
                    type="time"
                    value={row.time}
                    onChange={(e) =>
                      setActivityRows((rows) =>
                        rows!.map((r, j) => (j === i ? { ...r, time: e.target.value } : r)),
                      )
                    }
                    aria-label={m.actions.timeOfDay}
                    className="h-10 text-center text-xs"
                    dir="ltr"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* One tap instead of one dropdown per line, which is exactly the
              per-item work this screen exists to avoid. */}
          {activityRows.some((r) => !r.clientId && r.clientGuess.trim()) ? (
            <button
              type="button"
              onClick={() =>
                setActivityRows((rows) =>
                  rows!.map((r) =>
                    !r.clientId && r.clientGuess.trim()
                      ? { ...r, clientId: NEW_CLIENT }
                      : r,
                  ),
                )
              }
              className="mt-3 w-full rounded-md border border-dashed border-accent px-3 py-2.5 text-xs font-medium text-accent transition-colors hover:bg-accent-soft"
            >
              +{" "}
              {m.importer.createAllMissing.replace(
                "{n}",
                String(
                  activityRows.filter((r) => !r.clientId && r.clientGuess.trim())
                    .length,
                ),
              )}
            </button>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={saveActivity}
              disabled={busy || !activityRows.some((r) => r.include && r.clientId)}
            >
              {busy
                ? m.common.saving
                : `${m.importer.saveAll} (${activityRows.filter((r) => r.include && r.clientId).length})`}
            </Button>
            <Button variant="ghost" onClick={reset}>
              {m.common.cancel}
            </Button>
          </div>
        </Card>
      ) : null}

      <Button variant="ghost" onClick={() => router.push(`/${locale}/clients`)}>
        ← {m.clients.title}
      </Button>
    </div>
  );
}
