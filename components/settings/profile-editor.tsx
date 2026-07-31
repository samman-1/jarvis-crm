"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSession } from "@/components/providers/session-provider";
import { useAsync, useMounted } from "@/lib/hooks/use-async";
import { db } from "@/lib/data";
import {
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Skeleton,
} from "@/components/ui/primitives";
import { HOURS_ENABLED } from "@/lib/efficiency";
import type { Locale } from "@/lib/i18n/config";

/** Photos are downscaled before storing — a phone camera shot is far too big. */
const MAX_PHOTO_PX = 256;

async function toSquareDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = MAX_PHOTO_PX;
  canvas.height = MAX_PHOTO_PX;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that image.");

  // Centre-crop to a square, then scale down.
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    MAX_PHOTO_PX,
    MAX_PHOTO_PX,
  );
  bitmap.close();

  return canvas.toDataURL("image/jpeg", 0.82);
}

export function ProfileEditor({ locale }: { locale: Locale }) {
  const { m } = useI18n();
  const { user, member } = useSession();
  const mounted = useMounted();
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const profile = useAsync(
    () => (mounted ? db().getProfile(user.id) : Promise.resolve(null)),
    [mounted, user.id],
  );

  const p = profile.data;
  /* The three text fields copy their starting value from the fetched profile.
     Keying the form on `updatedAt` remounts it when a save lands, which is
     simpler and safer than syncing state inside render. */

  async function pickPhoto(file: File) {
    setBusy(true);
    setError("");
    try {
      const dataUrl = await toSquareDataUrl(file);
      await db().updateProfile(user.id, { photo: dataUrl });
      profile.reload();
      flashSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveDetails(v: { start: string; end: string; phone: string }) {
    setBusy(true);
    try {
      await db().updateProfile(user.id, {
        plannedStart: v.start,
        plannedEnd: v.end,
        phone: v.phone.trim(),
      });
      profile.reload();
      flashSaved();
    } finally {
      setBusy(false);
    }
  }

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!mounted || profile.loading) return <Skeleton className="h-64" />;

  return (
    <Card>
      <CardHeader
        title={m.settings.profile}
        action={
          saved ? (
            <span className="text-xs font-medium text-success">
              ✓ {m.actions.saved}
            </span>
          ) : null
        }
      />

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="group relative size-20 shrink-0 overflow-hidden rounded-full"
          style={{
            backgroundColor: `${member.color}1f`,
            boxShadow: `inset 0 0 0 1px ${member.color}55`,
          }}
          aria-label={m.settings.changePhoto}
        >
          {p?.photo ? (
            // A data URL of the member's own photo — next/image would need a
            // loader for this and buys nothing at 256px.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.photo}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <span
              className="flex size-full items-center justify-center font-display text-2xl font-bold"
              style={{ color: member.color }}
            >
              {member.initials}
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
            {m.settings.changePhoto}
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-semibold">
            {locale === "ar" ? member.nameAr : member.name}
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
              {m.settings.changePhoto}
            </Button>
            {p?.photo ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={async () => {
                  await db().updateProfile(user.id, { photo: "" });
                  profile.reload();
                }}
              >
                {m.settings.removePhoto}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void pickPhoto(file);
          e.target.value = "";
        }}
      />

      {error ? <p className="mt-2 text-xs text-critical">{error}</p> : null}

      <DetailFields
        key={p?.updatedAt ?? "new"}
        initialStart={p?.plannedStart ?? ""}
        initialEnd={p?.plannedEnd ?? ""}
        initialPhone={p?.phone ?? ""}
        busy={busy}
        onSave={saveDetails}
        m={m}
      />
    </Card>
  );
}

function DetailFields({
  initialStart,
  initialEnd,
  initialPhone,
  busy,
  onSave,
  m,
}: {
  initialStart: string;
  initialEnd: string;
  initialPhone: string;
  busy: boolean;
  onSave: (v: { start: string; end: string; phone: string }) => void;
  m: ReturnType<typeof useI18n>["m"];
}) {
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [phone, setPhone] = useState(initialPhone);

  const changed =
    start !== initialStart || end !== initialEnd || phone !== initialPhone;

  return (
    <>
      {/* Planned hours only mean something while attendance is being scored.
          With scoring off they were two inputs that changed nothing, sitting
          under a caption promising they did. */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {HOURS_ENABLED ? (
          <>
            <Field label={m.hours.from}>
              <Input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="h-11"
                dir="ltr"
              />
            </Field>
            <Field label={m.hours.to}>
              <Input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="h-11"
                dir="ltr"
              />
            </Field>
          </>
        ) : null}
        <Field label={m.actions.contactPhone}>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-11"
            inputMode="tel"
            dir="ltr"
          />
        </Field>
      </div>
      {HOURS_ENABLED ? (
        <p className="mt-1.5 text-xs text-faint">{m.settings.hoursHint}</p>
      ) : null}

      {changed ? (
        <Button
          variant="primary"
          size="sm"
          className="mt-3"
          onClick={() => onSave({ start, end, phone })}
          disabled={busy}
        >
          {busy ? m.common.saving : m.actions.saveChanges}
        </Button>
      ) : null}
    </>
  );
}
