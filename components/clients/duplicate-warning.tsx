"use client";

import Link from "next/link";
import { useI18n } from "@/components/providers/i18n-provider";
import { MemberBadge, StageChip } from "@/components/ui/badges";
import { Button } from "@/components/ui/primitives";
import type { DuplicateMatch } from "@/lib/types";
import { PUBLIC_MEMBERS } from "@/lib/config/members";
import { formatDate, relativeDays } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * The warning that stops two of us walking into the same company.
 *
 * Three intensities, taken from the matched client's status:
 *   block → dead client. Full red panel, must be explicitly overridden.
 *   warn  → active / on hold / already a client. Amber, with a one-tap
 *           "add me as a collaborator" so the right move is the easy move.
 *   info  → previously lost. Quiet note, since retrying is legitimate.
 */
export function DuplicateWarning({
  matches,
  locale,
  onAddMe,
  onDismiss,
  dismissed,
}: {
  matches: DuplicateMatch[];
  locale: string;
  onAddMe?: (clientId: string) => void;
  onDismiss?: () => void;
  dismissed?: boolean;
}) {
  const { m } = useI18n();
  if (!matches.length || dismissed) return null;

  return (
    <div className="space-y-3">
      {matches.map((match) => (
        <MatchCard
          key={match.client.id}
          match={match}
          locale={locale}
          onAddMe={onAddMe}
          onDismiss={onDismiss}
          m={m}
        />
      ))}
    </div>
  );
}

function MatchCard({
  match,
  locale,
  onAddMe,
  onDismiss,
  m,
}: {
  match: DuplicateMatch;
  locale: string;
  onAddMe?: (clientId: string) => void;
  onDismiss?: () => void;
  m: ReturnType<typeof useI18n>["m"];
}) {
  const client = match.client;
  const owner = PUBLIC_MEMBERS.find((p) => p.id === client.ownerId);
  const closer = PUBLIC_MEMBERS.find((p) => p.id === client.closedById) ?? owner;
  const ownerName = owner
    ? (locale === "ar" ? owner.nameAr : owner.name)
    : "";

  /* ---------------- Dead: the hard stop ---------------- */
  if (match.level === "block") {
    return (
      <div
        className="animate-enter overflow-hidden rounded-lg border-2 bg-critical-soft"
        style={{ borderColor: "var(--critical)" }}
        role="alert"
      >
        <div
          className="px-4 py-2.5 text-sm font-bold tracking-wide text-white uppercase"
          style={{ backgroundColor: "var(--critical)" }}
        >
          ⛔ {m.duplicate.deadTitle}
        </div>

        <div className="space-y-3 p-4">
          <div>
            <Link
              href={`/${locale}/clients/${client.id}`}
              className="font-display text-lg font-bold underline-offset-4 hover:underline"
            >
              {locale === "ar" && client.nameAr ? client.nameAr : client.name}
            </Link>
            <p className="mt-1 text-xs text-muted">
              {m.duplicate.deadBy}{" "}
              <span className="font-semibold text-fg">
                {closer
                  ? (locale === "ar" ? closer.nameAr : closer.name)
                  : ""}
              </span>{" "}
              {m.duplicate.deadOn}{" "}
              <span className="font-semibold text-fg">
                {formatDate(client.closedAt, locale as "en" | "ar")}
              </span>
            </p>
          </div>

          {client.closedReason ? (
            <blockquote
              className="rounded-md border-s-2 bg-surface px-3.5 py-3 text-sm leading-relaxed"
              style={{ borderInlineStartColor: "var(--critical)" }}
            >
              <span className="mb-1 block text-[11px] font-semibold tracking-wide text-critical uppercase">
                {m.duplicate.deadReason}
              </span>
              {client.closedReason}
            </blockquote>
          ) : null}

          {client.teamWarning ? (
            <p className="text-sm font-medium text-critical">
              {client.teamWarning}
            </p>
          ) : null}

          <p className="text-sm font-semibold">{m.duplicate.deadWasted}</p>

          <div className="flex flex-wrap gap-2 pt-1">
            <Link href={`/${locale}/clients/${client.id}`}>
              <Button size="sm" variant="secondary">
                {m.duplicate.openClient}
              </Button>
            </Link>
            {onDismiss ? (
              <Button size="sm" variant="ghost" onClick={onDismiss}>
                {m.duplicate.deadOverride}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- Warn / info ---------------- */
  const isWarn = match.level === "warn";
  const accent = isWarn ? "var(--warn)" : "var(--muted)";
  const title =
    client.status === "on_hold"
      ? m.duplicate.onHoldTitle
      : client.status === "lost_retryable"
        ? m.duplicate.retryTitle
        : m.duplicate.ownedTitle;

  return (
    <div
      className={cn(
        "animate-enter rounded-lg border p-4",
        isWarn ? "bg-warn-soft" : "bg-surface-2",
      )}
      style={{ borderColor: isWarn ? "var(--warn)" : "var(--border)" }}
      role="status"
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase" style={{ color: accent }}>
        {isWarn ? "⚠" : "ℹ"} {title}
        {match.reason === "phone" ? (
          <span className="font-normal text-faint normal-case">
            · {m.duplicate.matchedPhone}
          </span>
        ) : null}
      </div>

      <p className="text-sm leading-relaxed">
        <Link
          href={`/${locale}/clients/${client.id}`}
          className="font-display font-semibold underline-offset-4 hover:underline"
        >
          {locale === "ar" && client.nameAr ? client.nameAr : client.name}
        </Link>{" "}
        <span className="text-muted">{m.duplicate.ownedBy}</span>{" "}
        <span className="font-semibold">{ownerName}</span>
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <MemberBadge memberId={client.ownerId} size="xs" />
        </span>
        <StageChip stage={client.stage} />
        <span>
          {m.duplicate.lastContacted}:{" "}
          <span className="text-fg">
            {relativeDays(client.lastContactAt, locale as "en" | "ar")}
          </span>
        </span>
      </div>

      {client.teamWarning ? (
        <p className="mt-2.5 rounded-md bg-surface px-3 py-2 text-xs leading-relaxed text-warn">
          {client.teamWarning}
        </p>
      ) : null}

      {client.status === "lost_retryable" ? (
        <p className="mt-2 text-xs text-faint">{m.duplicate.retryHint}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/${locale}/clients/${client.id}`}>
          <Button size="sm" variant="secondary">
            {m.duplicate.openClient}
          </Button>
        </Link>
        {onAddMe ? (
          <Button
            size="sm"
            variant="primary"
            onClick={() => onAddMe(client.id)}
          >
            {m.duplicate.addMe}
          </Button>
        ) : null}
        {onDismiss ? (
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            {m.duplicate.differentCompany}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
