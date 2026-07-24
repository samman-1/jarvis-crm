"use client";

import { addDays } from "date-fns";
import { useMemo, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSession } from "@/components/providers/session-provider";
import { useAsync, useMounted } from "@/lib/hooks/use-async";
import { db } from "@/lib/data";
import { Card, CardHeader, Input, Skeleton } from "@/components/ui/primitives";
import {
  DEFAULT_END,
  DEFAULT_START,
  WEEK,
  toMinutes,
} from "@/lib/config/schedule";
import { formatMinutes, cn } from "@/lib/utils";
import {
  rangeFor,
  startOfWorkWeek,
  toDateKey,
  toTimeInput,
} from "@/lib/dates";
import type { Attendance } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";

/** Sunday through Thursday — Wednesday and Thursday can be voted in. */
const ENTRY_DAYS = WEEK.filter((d) => d.type !== "off");

/**
 * Your hours for the week, typed in rather than clocked.
 *
 * This replaced a live check-in button. In practice nobody opens a website
 * at the moment they walk into a client — they fill the week in afterwards,
 * from their phone. So each day is just two time fields and an optional
 * note, editable at any point, with a running total against the target.
 *
 * You can only edit your own row. Everyone can see everyone's.
 */
export function HoursGrid({
  locale,
  weekOffset = 0,
  onSaved,
}: {
  locale: Locale;
  weekOffset?: number;
  onSaved?: () => void;
}) {
  const { m } = useI18n();
  const { user, member } = useSession();
  const mounted = useMounted();
  const [savingKey, setSavingKey] = useState("");

  const weekStart = useMemo(
    () => startOfWorkWeek(addDays(new Date(), weekOffset * 7)),
    [weekOffset],
  );

  const range = useMemo(
    () => rangeFor("week", addDays(new Date(), weekOffset * 7)),
    [weekOffset],
  );

  const { data, loading, reload } = useAsync(
    () =>
      mounted ? db().attendanceFor(user.id, range) : Promise.resolve([] as Attendance[]),
    [mounted, user.id, range.from],
  );

  const rows = data ?? [];
  const byDate = new Map(rows.map((r) => [r.date, r]));

  const totalWorked = rows.reduce((sum, r) => sum + r.minutesWorked, 0);
  const targetMinutes =
    ENTRY_DAYS.filter((d) => d.scored).length *
    (toMinutes(DEFAULT_END) - toMinutes(DEFAULT_START));

  async function save(
    dateKey: string,
    next: { checkIn: string | null; checkOut: string | null; reason?: string },
  ) {
    setSavingKey(dateKey);
    try {
      await db().setHours(user.id, dateKey, next);
      reload();
      onSaved?.();
    } finally {
      setSavingKey("");
    }
  }

  if (loading) return <Skeleton className="h-64" />;

  return (
    <Card>
      <CardHeader
        title={m.hours.title}
        hint={m.hours.hint}
        action={
          <span className="tnum text-xs text-muted">
            {formatMinutes(totalWorked)}
            <span className="text-faint">
              {" / "}
              {formatMinutes(targetMinutes)}
            </span>
          </span>
        }
      />

      <div className="space-y-2">
        {ENTRY_DAYS.map((day) => {
          const date = addDays(weekStart, day.day);
          const dateKey = toDateKey(date);
          const record = byDate.get(dateKey);
          const future = date > new Date();
          const saving = savingKey === dateKey;

          return (
            <DayRow
              /* The saved times are copied into local state on mount, so the
                 key carries them: when the fetch lands (or a save changes
                 them) the row remounts and picks the new values up. Without
                 this the fields render empty even though the day has hours. */
              key={`${dateKey}:${record?.checkInAt ?? ""}:${record?.checkOutAt ?? ""}`}
              label={locale === "ar" ? day.labelAr : day.label}
              dateLabel={new Intl.DateTimeFormat(
                locale === "ar" ? "ar-SA" : "en-GB",
                { day: "numeric", month: "short" },
              ).format(date)}
              conditional={day.type === "conditional"}
              record={record}
              future={future}
              saving={saving}
              color={member.color}
              onSave={(next) => save(dateKey, next)}
              m={m}
            />
          );
        })}
      </div>

      <p className="mt-3 text-xs text-faint">{m.hours.footnote}</p>
    </Card>
  );
}

function DayRow({
  label,
  dateLabel,
  conditional,
  record,
  future,
  saving,
  color,
  onSave,
  m,
}: {
  label: string;
  dateLabel: string;
  conditional: boolean;
  record: Attendance | undefined;
  future: boolean;
  saving: boolean;
  color: string;
  onSave: (next: {
    checkIn: string | null;
    checkOut: string | null;
    reason?: string;
  }) => void;
  m: ReturnType<typeof useI18n>["m"];
}) {
  const [start, setStart] = useState(toTimeInput(record?.checkInAt ?? null));
  const [end, setEnd] = useState(toTimeInput(record?.checkOutAt ?? null));
  const [reason, setReason] = useState(record?.reason ?? "");
  const [showReason, setShowReason] = useState(Boolean(record?.reason));

  const worked = record?.minutesWorked ?? 0;
  const late =
    record?.status === "late" ? true : false;
  const early = record?.status === "left_early";
  const off = !record?.checkInAt;

  function commit(nextStart: string, nextEnd: string, nextReason: string) {
    onSave({
      checkIn: nextStart || null,
      checkOut: nextEnd || null,
      reason: nextReason,
    });
  }

  return (
    <div
      className={cn(
        "rounded-md border p-3 transition-colors",
        future
          ? "border-dashed border-border opacity-60"
          : off
            ? "border-border bg-surface-2"
            : "border-border bg-surface-2",
      )}
      style={
        !off && !future
          ? { borderInlineStartWidth: 3, borderInlineStartColor: color }
          : undefined
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-sm font-medium">
          {label}
          {conditional ? (
            <span className="ms-1.5 text-[10px] text-faint">
              {m.calendar.conditional}
            </span>
          ) : null}
          <span className="tnum ms-2 text-xs font-normal text-faint">
            {dateLabel}
          </span>
        </div>

        <div className="tnum shrink-0 text-xs">
          {off ? (
            <span className="text-faint">{future ? "" : m.hours.notEntered}</span>
          ) : (
            <span
              style={{ color: late || early ? "var(--warn)" : "var(--success)" }}
            >
              {formatMinutes(worked)}
            </span>
          )}
        </div>
      </div>

      {/* Native time pickers — these open the phone's own wheel, which is the
          fastest way to enter this standing outside a client's office. They
          get the full row width because a 12-hour locale renders "09:05 AM"
          and anything narrower clips it. */}
      <div className="mt-2 flex items-center gap-2">
        <Input
          type="time"
          value={start}
          disabled={future || saving}
          aria-label={m.hours.from}
          onChange={(e) => setStart(e.target.value)}
          onBlur={() => commit(start, end, reason)}
          className="h-11 min-w-0 flex-1 text-center text-sm"
          dir="ltr"
        />
        <span className="shrink-0 text-faint">–</span>
        <Input
          type="time"
          value={end}
          disabled={future || saving}
          aria-label={m.hours.to}
          onChange={(e) => setEnd(e.target.value)}
          onBlur={() => commit(start, end, reason)}
          className="h-11 min-w-0 flex-1 text-center text-sm"
          dir="ltr"
        />
      </div>

      {/* The reason only matters when the day is short — so it only appears
          when the day is short, or when the member asks for it. */}
      {!future && (late || early || showReason) ? (
        <div className="mt-2">
          <Input
            value={reason}
            placeholder={m.hours.reasonPlaceholder}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => commit(start, end, reason)}
            className="h-9 text-xs"
          />
        </div>
      ) : !future && !off ? (
        <button
          type="button"
          onClick={() => setShowReason(true)}
          className="mt-1.5 text-[11px] text-faint transition-colors hover:text-fg"
        >
          + {m.hours.addNote}
        </button>
      ) : null}
    </div>
  );
}
