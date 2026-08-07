"use client";

import Link from "next/link";
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
  open,
  onOpenChange,
  bare = false,
}: {
  clients: ClientRow[];
  locale: Locale;
  onLogged: () => void;
  /** Controlled by the page so the empty timeline can open this form too. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Render only the form, with no card around it.
   *
   * The home page used to carry "Log what you did" and "What you did" as two
   * separate cards, which is one idea wearing two hats. The timeline card now
   * hosts this form directly.
   */
  bare?: boolean;
}) {
  const { m } = useI18n();
  const { user } = useSession();

  const setOpen = (next: boolean) => onOpenChange(next);
  const [clientId, setClientId] = useState("");
  const [type, setType] = useState<InteractionType>("visit");
  const [summary, setSummary] = useState("");
  const [when, setWhen] = useState(toDateKey(new Date()));
  // Defaults to now, because most entries are made minutes after the visit —
  // but editable, because plenty are typed up in the evening.
  const [atTime, setAtTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const alive = clients.filter((c) => c.status !== "dead");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !summary.trim()) return;
    setBusy(true);
    try {
      await db().logInteraction({
        clientId,
        memberId: user.id,
        type,
        summary: summary.trim(),
        happenedAt: new Date(`${when}T${atTime || "12:00"}:00`).toISOString(),
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

  const form = (
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

          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              aria-label={m.common.date}
              className="h-11"
              dir="ltr"
            />
            <Input
              type="time"
              value={atTime}
              onChange={(e) => setAtTime(e.target.value)}
              aria-label={m.actions.timeOfDay}
              className="h-11 text-center"
              dir="ltr"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={busy || !clientId || !summary.trim()}
          >
            {busy ? m.common.saving : m.actions.logIt}
          </Button>
        </form>
  );

  // Inside the timeline card: the form only, opened from that card's header.
  if (bare) return open ? form : null;

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
            <div className="flex items-center gap-2">
              <Link href={`/${locale}/clients/import?mode=activity`}>
                <Button size="sm" variant="secondary">
                  {m.actions.logMany}
                </Button>
              </Link>
              <Button
                size="sm"
                variant={open ? "ghost" : "primary"}
                onClick={() => setOpen(!open)}
              >
                {open ? m.common.cancel : `+ ${m.dashboard.logInteraction}`}
              </Button>
            </div>
          )
        }
      />
      {open ? form : null}
    </Card>
  );
}
