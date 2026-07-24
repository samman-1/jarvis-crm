"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSession } from "@/components/providers/session-provider";
import { useAsync, useMounted } from "@/lib/hooks/use-async";
import { db } from "@/lib/data";
import {
  Button,
  Card,
  CardHeader,
  Divider,
  EmptyState,
  Field,
  Input,
  Select,
  Skeleton,
  Textarea,
} from "@/components/ui/primitives";
import {
  InteractionIcon,
  InteractionLabel,
  MemberBadge,
  StatusChip,
} from "@/components/ui/badges";
import { PageHeader } from "@/components/shell/page-header";
import {
  INTERACTION_TYPES,
  STAGES,
  STATUSES,
  type ClientStatus,
  type InteractionType,
  type Stage,
  stageDef,
  stageIndex,
} from "@/lib/config/stages";
import { PUBLIC_MEMBERS } from "@/lib/config/members";
import type { Locale } from "@/lib/i18n/config";
import { formatDate, formatDateTime, relativeDays } from "@/lib/dates";
import { cn, formatSar } from "@/lib/utils";

export function ClientDetail({
  clientId,
  locale,
}: {
  clientId: string;
  locale: Locale;
}) {
  const { m } = useI18n();
  const { user } = useSession();
  const mounted = useMounted();

  const { data, loading, reload } = useAsync(
    () => (mounted ? db().getClient(clientId) : Promise.resolve(null)),
    [mounted, clientId],
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64" />
          <Skeleton className="h-64 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        title={m.client.notFound}
        action={
          <Link href={`/${locale}/clients`}>
            <Button size="sm">{m.clients.title}</Button>
          </Link>
        }
      />
    );
  }

  const client = data;
  const dead = client.status === "dead";
  const owner = PUBLIC_MEMBERS.find((p) => p.id === client.ownerId);
  const closer = PUBLIC_MEMBERS.find((p) => p.id === client.closedById);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/${locale}/clients`}
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-fg"
        >
          <span aria-hidden className="rtl:rotate-180">
            ←
          </span>
          {m.clients.title}
        </Link>

        <PageHeader
          title={
            <span className={cn(dead && "text-critical line-through")}>
              {locale === "ar" && client.nameAr ? client.nameAr : client.name}
            </span>
          }
          subtitle={[client.city, client.industry].filter(Boolean).join(" · ")}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status={client.status} />
              <MemberBadge memberId={client.ownerId} size="md" showName />
            </div>
          }
        />
      </div>

      {/* --- Dead banner: impossible to miss ------------------------- */}
      {dead ? (
        <div
          className="overflow-hidden rounded-lg border-2 bg-critical-soft"
          style={{ borderColor: "var(--critical)" }}
        >
          <div
            className="px-4 py-2 text-xs font-bold tracking-wide text-white uppercase"
            style={{ backgroundColor: "var(--critical)" }}
          >
            ⛔ {m.duplicate.deadTitle}
          </div>
          <div className="space-y-2 p-4">
            <p className="text-xs text-muted">
              {m.client.closedBy}{" "}
              <span className="font-semibold text-fg">
                {closer
                  ? (locale === "ar" ? closer.nameAr : closer.name)
                  : "—"}
              </span>{" "}
              · {formatDate(client.closedAt, locale)}
            </p>
            {client.closedReason ? (
              <p className="text-sm leading-relaxed">{client.closedReason}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* --- Team warning ------------------------------------------- */}
      {client.teamWarning ? (
        <div className="rounded-lg border border-warn bg-warn-soft p-4">
          <div className="mb-1 text-[11px] font-semibold tracking-wide text-warn uppercase">
            ⚠ {m.client.teamWarning}
          </div>
          <p className="text-sm leading-relaxed">{client.teamWarning}</p>
        </div>
      ) : null}

      <StageStepper client={client} onChanged={reload} locale={locale} />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* --- Left: contacts + facts ------------------------------- */}
        <div className="space-y-4">
          <Card>
            <CardHeader title={m.client.contacts} />
            {client.contacts.length === 0 ? (
              <p className="text-xs text-faint">{m.common.empty}</p>
            ) : (
              <div className="space-y-3">
                {client.contacts.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-md border border-border bg-surface-2 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {c.name}
                        </div>
                        <div className="truncate text-xs text-faint">
                          {c.title}
                        </div>
                      </div>
                      {c.isPrimary ? (
                        <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent">
                          {m.client.primary}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {c.phone ? (
                        <a
                          href={`tel:${c.phone.replace(/\s/g, "")}`}
                          className="inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
                          dir="ltr"
                        >
                          📞 {c.phone}
                        </a>
                      ) : null}
                      {c.whatsapp || c.phone ? (
                        <a
                          href={`https://wa.me/${(c.whatsapp || c.phone).replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-1 text-xs text-muted transition-colors hover:border-success hover:text-success"
                        >
                          💬 WhatsApp
                        </a>
                      ) : null}
                      {c.email ? (
                        <a
                          href={`mailto:${c.email}`}
                          className="inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-1 text-xs text-muted transition-colors hover:border-info hover:text-info"
                          dir="ltr"
                        >
                          ✉️ {c.email}
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title={m.client.money} />
            <div className="space-y-3">
              <div>
                <div className="text-[11px] tracking-wide text-muted uppercase">
                  {m.client.money}
                </div>
                {client.dealValueSar ? (
                  <div className="tnum font-display text-2xl font-semibold">
                    {formatSar(client.dealValueSar)}
                    <span className="ms-1.5 text-sm font-normal text-faint">
                      {m.common.sar}
                    </span>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-faint">{m.client.moneyEmpty}</p>
                )}
              </div>
              <Divider />
              <Detail label={m.client.source} value={client.source} />
              {client.referredBy ? (
                <Detail label={m.client.referredBy} value={client.referredBy} />
              ) : null}
              <Detail
                label={m.clients.broughtBy}
                value={
                  <MemberBadge memberId={client.broughtById} size="xs" showName />
                }
              />
              {client.collaboratorIds.length ? (
                <Detail
                  label={m.clients.alsoWorking}
                  value={
                    <span className="flex gap-1">
                      {client.collaboratorIds.map((id) => (
                        <MemberBadge key={id} memberId={id} size="xs" showName />
                      ))}
                    </span>
                  }
                />
              ) : null}
              {client.revisitAfter ? (
                <Detail
                  label={m.client.revisitAfter}
                  value={formatDate(client.revisitAfter, locale)}
                />
              ) : null}
              {client.website ? (
                <Detail label="Web" value={client.website} />
              ) : null}
            </div>
          </Card>

          <StatusPanel client={client} onChanged={reload} locale={locale} />
        </div>

        {/* --- Right: story + timeline ------------------------------ */}
        <div className="space-y-4 lg:col-span-2">
          {client.whatHappened || client.whatWeOffered || client.objection ? (
            <Card>
              <CardHeader title={m.client.whatHappened} />
              <div className="space-y-3">
                {client.whatHappened ? (
                  <p className="text-sm leading-relaxed">{client.whatHappened}</p>
                ) : null}
                {client.whatWeOffered ? (
                  <Detail
                    label={m.client.whatWeOffered}
                    value={client.whatWeOffered}
                  />
                ) : null}
                {client.objection ? (
                  <Detail label={m.client.objection} value={client.objection} />
                ) : null}
                {client.nextAction ? (
                  <div className="rounded-md border border-accent/30 bg-accent-softer px-3 py-2.5">
                    <div className="text-[11px] font-semibold tracking-wide text-accent uppercase">
                      {m.clients.nextAction}
                    </div>
                    <p className="mt-0.5 text-sm">{client.nextAction}</p>
                    {client.nextActionAt ? (
                      <p className="mt-1 text-xs text-muted">
                        {formatDate(client.nextActionAt, locale)} ·{" "}
                        {relativeDays(client.nextActionAt, locale)}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}

          <LogInteraction
            clientId={client.id}
            currentStage={client.stage}
            onLogged={reload}
            locale={locale}
          />

          <Card>
            <CardHeader
              title={m.client.timeline}
              hint={`${client.interactions.length}`}
            />
            {client.interactions.length === 0 ? (
              <p className="text-xs text-faint">{m.client.noInteractions}</p>
            ) : (
              <ol className="relative space-y-4 ps-7">
                <span
                  aria-hidden
                  className="absolute inset-y-1 w-px bg-border ltr:left-3.5 rtl:right-3.5"
                />
                {client.interactions.map((i) => (
                  <li key={i.id} className="relative">
                    <span className="absolute top-0 ltr:-left-7 rtl:-right-7">
                      <InteractionIcon type={i.type} />
                    </span>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-sm font-medium">
                        <InteractionLabel type={i.type} />
                      </span>
                      <MemberBadge memberId={i.memberId} size="xs" />
                      <span className="tnum text-xs text-faint">
                        {formatDateTime(i.happenedAt, locale)}
                      </span>
                      {i.durationMin ? (
                        <span className="tnum text-xs text-faint">
                          · {i.durationMin}m
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted">
                      {i.summary}
                    </p>
                    {i.outcome ? (
                      <p className="mt-1 text-xs text-faint">{i.outcome}</p>
                    ) : null}
                    {i.stageBefore && i.stageAfter ? (
                      <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-[11px]">
                        <span style={{ color: stageDef(i.stageBefore).color }}>
                          {locale === "ar"
                            ? stageDef(i.stageBefore).labelAr
                            : stageDef(i.stageBefore).label}
                        </span>
                        <span className="text-faint rtl:rotate-180">→</span>
                        <span style={{ color: stageDef(i.stageAfter).color }}>
                          {locale === "ar"
                            ? stageDef(i.stageAfter).labelAr
                            : stageDef(i.stageAfter).label}
                        </span>
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Detail({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] tracking-wide text-muted uppercase">
        {label}
      </div>
      <div className="mt-0.5 text-sm">{value || "—"}</div>
    </div>
  );
}

/* --- Stage stepper ------------------------------------------------- */

function StageStepper({
  client,
  onChanged,
  locale,
}: {
  client: { id: string; stage: Stage; status: ClientStatus };
  onChanged: () => void;
  locale: Locale;
}) {
  const { user } = useSession();
  const [busy, setBusy] = useState(false);
  const current = stageIndex(client.stage);

  async function move(stage: Stage) {
    if (stage === client.stage || busy) return;
    setBusy(true);
    try {
      await db().setStage(client.id, stage, user.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max gap-1.5">
        {STAGES.map((s, i) => {
          const active = s.id === client.stage;
          const passed = i < current && s.id !== "lost";
          return (
            <button
              key={s.id}
              type="button"
              disabled={busy || client.status === "dead"}
              onClick={() => move(s.id)}
              className={cn(
                "rounded-md border px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                active
                  ? "border-transparent"
                  : passed
                    ? "border-border bg-surface-2 text-muted"
                    : "border-border text-faint hover:border-border-strong hover:text-fg",
              )}
              style={
                active
                  ? { backgroundColor: s.soft, color: s.color, borderColor: s.color }
                  : undefined
              }
            >
              {locale === "ar" ? s.labelAr : s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* --- Status panel, including the dead flow ------------------------- */

function StatusPanel({
  client,
  onChanged,
  locale,
}: {
  client: { id: string; status: ClientStatus };
  onChanged: () => void;
  locale: Locale;
}) {
  const { m } = useI18n();
  const { user } = useSession();
  const [status, setStatus] = useState<ClientStatus>(client.status);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const changed = status !== client.status;
  const needsReason = status === "dead";

  async function apply() {
    if (needsReason && !reason.trim()) {
      setError(m.client.deadReasonRequired);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await db().setStatus(client.id, status, user.id, { reason: reason.trim() });
      setReason("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title={m.client.changeStatus} />
      <div className="space-y-3">
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as ClientStatus)}
        >
          {STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {locale === "ar" ? s.labelAr : s.label}
            </option>
          ))}
        </Select>

        {needsReason && changed ? (
          <Field
            label={m.client.deadReasonLabel}
            hint={m.client.deadReasonHint}
            required
          >
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-20 border-critical"
            />
          </Field>
        ) : null}

        {error ? <p className="text-xs text-critical">{error}</p> : null}

        {changed ? (
          <Button
            variant={needsReason ? "danger" : "primary"}
            size="sm"
            className="w-full"
            onClick={apply}
            disabled={busy}
          >
            {busy ? m.common.saving : m.common.save}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

/* --- Log interaction composer -------------------------------------- */

function LogInteraction({
  clientId,
  currentStage,
  onLogged,
  locale,
}: {
  clientId: string;
  currentStage: Stage;
  onLogged: () => void;
  locale: Locale;
}) {
  const { m } = useI18n();
  const { user } = useSession();
  const [type, setType] = useState<InteractionType>("visit");
  const [summary, setSummary] = useState("");
  const [outcome, setOutcome] = useState("");
  const [newStage, setNewStage] = useState<Stage | "">("");
  const [duration, setDuration] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!summary.trim()) return;
    setBusy(true);
    try {
      await db().logInteraction({
        clientId,
        memberId: user.id,
        type,
        summary: summary.trim(),
        outcome: outcome.trim(),
        durationMin: duration ? Number(duration) : null,
        newStage: newStage || undefined,
      });
      setSummary("");
      setOutcome("");
      setDuration("");
      setNewStage("");
      setDone(true);
      setTimeout(() => setDone(false), 2000);
      onLogged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title={m.client.logTitle}
        action={
          done ? (
            <span className="text-xs font-medium text-success">
              ✓ {m.client.logged}
            </span>
          ) : null
        }
      />
      <form onSubmit={submit} className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {INTERACTION_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
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

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={m.client.logOutcome}>
            <Input
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="h-9 text-xs"
            />
          </Field>
          <Field label="min">
            <Input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="h-9 text-xs"
              dir="ltr"
            />
          </Field>
          <Field label={m.client.logStage}>
            <Select
              value={newStage}
              onChange={(e) => setNewStage(e.target.value as Stage | "")}
              className="h-9 text-xs"
            >
              <option value="">
                {locale === "ar"
                  ? stageDef(currentStage).labelAr
                  : stageDef(currentStage).label}
              </option>
              {STAGES.filter((s) => s.id !== currentStage).map((s) => (
                <option key={s.id} value={s.id}>
                  → {locale === "ar" ? s.labelAr : s.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={busy || !summary.trim()}
        >
          {busy ? m.common.saving : m.client.logSubmit}
        </Button>
      </form>
    </Card>
  );
}
