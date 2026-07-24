"use client";

import { useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSession } from "@/components/providers/session-provider";
import { db } from "@/lib/data";
import {
  Button,
  Card,
  CardHeader,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { INTERACTION_TYPES, type InteractionType } from "@/lib/config/stages";
import type { ClientRow } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";
import { toDateKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Log a visit without hunting for the client first.
 *
 * The previous build could only record activity from inside a client's page,
 * which meant four taps before you could type anything. This is the same
 * write, reachable from the page you land on.
 *
 * The date is editable because people log the day afterwards, not at the door.
 */
export function QuickLog({
  clients,
  locale,
  onLogged,
}: {
  clients: ClientRow[];
  locale: Locale;
  onLogged: () => void;
}) {
  const { m } = useI18n();
  const { user } = useSession();

  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [type, setType] = useState<InteractionType>("visit");
  const [summary, setSummary] = useState("");
  const [when, setWhen] = useState(toDateKey(new Date()));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const alive = clients.filter((c) => c.status !== "dead");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !summary.trim()) return;
    setBusy(true);
    try {
      // Midday on the chosen date, so it lands on the right day regardless
      // of when it was actually typed.
      await db().logInteraction({
        clientId,
        memberId: user.id,
        type,
        summary: summary.trim(),
        happenedAt: new Date(`${when}T12:00:00`).toISOString(),
      });
      setSummary("");
      setClientId("");
      setDone(true);
      setTimeout(() => setDone(false), 2200);
      setOpen(false);
      onLogged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title={m.actions.quickLog}
        hint={m.actions.quickLogHint}
        action={
          done ? (
            <span className="text-xs font-medium text-success">
              ✓ {m.actions.logged}
            </span>
          ) : (
            <Button
              size="sm"
              variant={open ? "ghost" : "primary"}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? m.common.cancel : `+ ${m.dashboard.logInteraction}`}
            </Button>
          )
        }
      />

      {open ? (
        <form onSubmit={submit} className="animate-enter space-y-3">
          <Select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            aria-label={m.actions.pickClient}
            className="h-11"
            autoFocus
          >
            <option value="">{m.actions.pickClient}</option>
            {alive.map((c) => (
              <option key={c.id} value={c.id}>
                {locale === "ar" && c.nameAr ? c.nameAr : c.name}
              </option>
            ))}
          </Select>

          <div className="flex flex-wrap gap-1.5">
            {INTERACTION_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id)}
                className={cn(
                  "rounded-full border px-3 py-2 text-xs font-medium transition-colors",
                  type === t.id
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border text-muted hover:text-fg",
                )}
              >
                <span aria-hidden className="me-1">
                  {t.icon}
                </span>
                {locale === "ar" ? t.labelAr : t.label}
              </button>
            ))}
          </div>

          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder={m.client.logPlaceholder}
            className="min-h-20"
          />

          <Input
            type="date"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            aria-label={m.actions.dueDate}
            className="h-11"
            dir="ltr"
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={busy || !clientId || !summary.trim()}
          >
            {busy ? m.common.saving : m.actions.logIt}
          </Button>
        </form>
      ) : null}
    </Card>
  );
}
