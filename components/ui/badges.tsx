"use client";

import { Chip, Dot } from "@/components/ui/primitives";
import { useI18n } from "@/components/providers/i18n-provider";
import {
  type ClientStatus,
  type InteractionType,
  type Stage,
  interactionTypeDef,
  stageDef,
  statusDef,
  contactMethodDef,
  type ContactMethod,
} from "@/lib/config/stages";
import { PUBLIC_MEMBERS } from "@/lib/config/members";
import { cn } from "@/lib/utils";

export function StageChip({ stage }: { stage: Stage }) {
  const { locale } = useI18n();
  const def = stageDef(stage);
  return (
    <Chip color={def.color} soft={def.soft} title={locale === "ar" ? def.hintAr : def.hint}>
      {locale === "ar" ? def.labelAr : def.label}
    </Chip>
  );
}

export function StatusChip({
  status,
  compact = false,
}: {
  status: ClientStatus;
  compact?: boolean;
}) {
  const { locale } = useI18n();
  const def = statusDef(status);
  const label = locale === "ar" ? def.labelAr : def.label;
  return (
    <Chip
      color={def.color}
      soft={def.soft}
      title={locale === "ar" ? def.hintAr : def.hint}
      className={status === "dead" ? "font-semibold" : undefined}
    >
      {status === "dead" ? "⛔ " : null}
      {compact && status === "dead" ? (locale === "ar" ? "منتهٍ" : "Dead") : label}
    </Chip>
  );
}

/**
 * The member badge — the thing you scan for on the all-clients board to
 * answer "whose client is this?" without reading anything.
 */
export function MemberBadge({
  memberId,
  size = "md",
  showName = false,
  muted = false,
}: {
  memberId: string;
  size?: "xs" | "sm" | "md";
  showName?: boolean;
  muted?: boolean;
}) {
  const { locale } = useI18n();
  const member = PUBLIC_MEMBERS.find((m) => m.id === memberId);
  if (!member) return null;

  const dims = {
    xs: "size-5 text-[9px]",
    sm: "size-6 text-[10px]",
    md: "size-8 text-xs",
  }[size];

  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold",
          dims,
        )}
        style={{
          backgroundColor: muted ? "var(--surface-3)" : `${member.color}26`,
          color: muted ? "var(--faint)" : member.color,
          boxShadow: `inset 0 0 0 1px ${member.color}55`,
        }}
        title={locale === "ar" ? member.nameAr : member.name}
      >
        {member.initials}
      </span>
      {showName ? (
        <span className="text-xs font-medium" style={{ color: member.color }}>
          {locale === "ar" ? member.nameAr : member.name}
        </span>
      ) : null}
    </span>
  );
}

export function InteractionIcon({ type }: { type: InteractionType }) {
  const def = interactionTypeDef(type);
  return (
    <span
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-sm"
      style={{ backgroundColor: "var(--surface-3)" }}
      aria-hidden
    >
      {def.icon}
    </span>
  );
}

export function InteractionLabel({ type }: { type: InteractionType }) {
  const { locale } = useI18n();
  const def = interactionTypeDef(type);
  return <>{locale === "ar" ? def.labelAr : def.label}</>;
}

/** "6d since contact" with a colour that darkens as the client goes cold. */
export function FreshnessChip({
  days,
  stale,
}: {
  days: number | null;
  stale: boolean;
}) {
  const { locale, m } = useI18n();
  if (days === null)
    return <span className="text-xs text-faint">{m.common.never}</span>;

  const color = stale
    ? "var(--critical)"
    : days > 7
      ? "var(--warn)"
      : "var(--muted)";

  return (
    <span className="tnum inline-flex items-center gap-1.5 text-xs" style={{ color }}>
      {stale ? <Dot color={color} /> : null}
      {days === 0
        ? m.common.today
        : locale === "ar"
          ? `${days} ${m.common.days}`
          : `${days}d`}
    </span>
  );
}

/**
 * How we reached them, next to where they are in the pipeline.
 *
 * Stage says "contacted" for a company you emailed and for one whose owner
 * sat with you for half an hour. This is the difference.
 */
export function ContactMethodChip({
  method,
  locale = "en",
}: {
  method: ContactMethod;
  locale?: "en" | "ar";
}) {
  const def = contactMethodDef(method);
  if (!def) return null;
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ color: def.color, backgroundColor: def.soft }}
      title={locale === "ar" ? def.hintAr : def.hint}
    >
      {locale === "ar" ? def.labelAr : def.label}
    </span>
  );
}
