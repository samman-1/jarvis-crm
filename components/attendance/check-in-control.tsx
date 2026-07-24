"use client";

import { useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSession } from "@/components/providers/session-provider";
import { useAsync, useMounted } from "@/lib/hooks/use-async";
import { db } from "@/lib/data";
import { Button, Input } from "@/components/ui/primitives";
import { formatTime } from "@/lib/dates";
import {
  DEFAULT_END,
  DEFAULT_START,
  EARLY_LEAVE_GRACE_MINUTES,
  LATE_GRACE_MINUTES,
  isFieldDay,
  toMinutes,
} from "@/lib/config/schedule";
import { cn } from "@/lib/utils";

/**
 * The header control that turns "I was out at clients" into data.
 *
 * One tap in, one tap out. Stepping outside the 09:00–14:00 window asks for a
 * reason before it will save — that reason is what the other two see in the
 * calendar, and it is the difference between "Aboodi was late" and "Aboodi was
 * late because the client moved the meeting".
 */
export function CheckInControl() {
  const { m } = useI18n();
  const { user } = useSession();
  const mounted = useMounted();
  const [reason, setReason] = useState("");
  const [asking, setAsking] = useState<null | "in" | "out">(null);
  const [busy, setBusy] = useState(false);

  const today = useAsync(
    () => (mounted ? db().attendanceToday(user.id) : Promise.resolve(null)),
    [mounted, user.id],
  );

  if (!mounted) return null;

  const record = today.data;
  const fieldDay = isFieldDay(new Date().getDay());
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const outsideWindowIn = nowMin > toMinutes(DEFAULT_START) + LATE_GRACE_MINUTES;
  const outsideWindowOut = nowMin < toMinutes(DEFAULT_END) - EARLY_LEAVE_GRACE_MINUTES;

  async function act(kind: "in" | "out", withReason: string) {
    setBusy(true);
    try {
      if (kind === "in") await db().checkIn(user.id, withReason);
      else await db().checkOut(user.id, withReason);
      setAsking(null);
      setReason("");
      today.reload();
    } finally {
      setBusy(false);
    }
  }

  function start(kind: "in" | "out") {
    const needsReason = kind === "in" ? outsideWindowIn : outsideWindowOut;
    if (needsReason) setAsking(kind);
    else void act(kind, "");
  }

  const checkedIn = Boolean(record?.checkInAt);
  const checkedOut = Boolean(record?.checkOutAt);

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {/* Wednesday and Thursday can be voted into working days at the
            Tuesday review, so checking in must stay possible on any day —
            it simply is not scored unless the day is a field day. */}
        {!fieldDay && !checkedIn ? (
          <span className="hidden text-xs text-faint sm:inline">
            {m.calendar.todayIsOff}
          </span>
        ) : null}

        {checkedIn ? (
          <span
            className={cn(
              "tnum hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex",
              checkedOut
                ? "bg-surface-2 text-muted"
                : "bg-success-soft text-success",
            )}
          >
            {!checkedOut ? (
              <span className="size-1.5 animate-live rounded-full bg-success" />
            ) : null}
            {m.calendar.checkedInAt} {formatTime(record!.checkInAt)}
            {checkedOut ? ` → ${formatTime(record!.checkOutAt)}` : null}
          </span>
        ) : null}

        {!checkedIn ? (
          <Button
            size="sm"
            variant={fieldDay ? "primary" : "quiet"}
            onClick={() => start("in")}
            disabled={busy}
          >
            {m.calendar.checkIn}
          </Button>
        ) : !checkedOut ? (
          <Button size="sm" variant="secondary" onClick={() => start("out")} disabled={busy}>
            {m.calendar.checkOut}
          </Button>
        ) : null}
      </div>

      {asking ? (
        <div className="animate-enter absolute top-full z-50 mt-2 w-72 rounded-lg border border-border bg-surface p-4 shadow-pop ltr:right-0 rtl:left-0">
          <p className="mb-2 text-xs leading-relaxed text-muted">
            {m.calendar.whyLate}
          </p>
          <Input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={m.calendar.reasonPlaceholder}
            onKeyDown={(e) => {
              if (e.key === "Enter" && reason.trim()) void act(asking, reason.trim());
              if (e.key === "Escape") setAsking(null);
            }}
          />
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="primary"
              className="flex-1"
              disabled={!reason.trim() || busy}
              onClick={() => void act(asking, reason.trim())}
            >
              {asking === "in" ? m.calendar.submitReason : m.calendar.submitReasonOut}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAsking(null)}>
              {m.common.cancel}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
