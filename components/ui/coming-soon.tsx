"use client";

import { Card, CardHeader } from "@/components/ui/primitives";
import { useI18n } from "@/components/providers/i18n-provider";

/**
 * Stands in for the efficiency score while scoring is switched off.
 *
 * Deliberately visible rather than deleted: the team should know the space is
 * reserved and the number is coming, not wonder whether it broke.
 */
export function ComingSoon({
  title,
  note,
  compact = false,
}: {
  title?: string;
  note?: string;
  compact?: boolean;
}) {
  const { m } = useI18n();

  if (compact) {
    return (
      <div className="flex items-center gap-2.5 rounded-md border border-dashed border-border px-3 py-2.5">
        <span className="size-2 shrink-0 rounded-full bg-faint" aria-hidden />
        <span className="text-xs text-faint">
          {title ?? m.dashboard.efficiency} — {m.common.comingSoon}
        </span>
      </div>
    );
  }

  return (
    <Card className="border-dashed">
      <CardHeader
        title={
          <span className="text-faint">{title ?? m.dashboard.efficiency}</span>
        }
      />
      <div className="flex items-center gap-3 opacity-60">
        <div
          className="size-16 shrink-0 rounded-full border-[6px] border-surface-3"
          aria-hidden
        />
        <div className="min-w-0 space-y-1.5">
          <div className="text-sm font-medium text-faint">
            {m.common.comingSoon}
          </div>
          <p className="text-xs leading-relaxed text-faint">
            {note ?? m.dashboard.efficiencyOff}
          </p>
        </div>
      </div>
    </Card>
  );
}
