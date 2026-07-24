"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSession } from "@/components/providers/session-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { db } from "@/lib/data";
import {
  Button,
  Card,
  CardHeader,
  Divider,
} from "@/components/ui/primitives";
import { LocaleSwitch } from "@/components/shell/locale-switch";
import { PageHeader } from "@/components/shell/page-header";
import { MemberBadge } from "@/components/ui/badges";
import { STAGES, STATUSES } from "@/lib/config/stages";
import { DEFAULT_END, DEFAULT_START, WEEK } from "@/lib/config/schedule";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export function SettingsView({ locale }: { locale: Locale }) {
  const { m } = useI18n();
  const { member } = useSession();
  const { theme, setTheme } = useTheme();
  const [busy, setBusy] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function exportData() {
    setBusy("export");
    try {
      const json = await db().exportAll();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jarvis-crm-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy("");
    }
  }

  async function importData(file: File) {
    setBusy("import");
    try {
      await db().importAll(await file.text());
      window.location.reload();
    } finally {
      setBusy("");
    }
  }

  async function reset() {
    if (!window.confirm(m.settings.resetConfirm)) return;
    setBusy("reset");
    try {
      await db().resetToSeed();
      window.location.reload();
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title={m.settings.title} />

      {/* --- The honest notice about Phase A --------------------------- */}
      <div className="rounded-lg border border-warn bg-warn-soft p-4">
        <div className="mb-1 text-[11px] font-semibold tracking-wide text-warn uppercase">
          {m.settings.phaseNotice}
        </div>
        <p className="text-sm leading-relaxed">{m.settings.phaseNoticeBody}</p>
      </div>

      <Card>
        <CardHeader title={m.settings.profile} />
        <div className="flex items-center gap-4">
          <MemberBadge memberId={member.id} size="md" />
          <div className="min-w-0 flex-1">
            <div className="font-display text-base font-semibold">
              {locale === "ar" ? member.nameAr : member.name}
            </div>
            <div className="text-sm text-muted">
              {locale === "ar" ? member.roleLabelAr : member.roleLabel}
            </div>
          </div>
        </div>

        <Divider className="my-4" />

        <div className="grid gap-3 sm:grid-cols-2">
          <Info label={m.settings.hours} value={`${DEFAULT_START} – ${DEFAULT_END}`} />
          <Info
            label={m.calendar.fieldDay}
            value={WEEK.filter((d) => d.scored)
              .map((d) => (locale === "ar" ? d.labelAr : d.label))
              .join(" · ")}
          />
        </div>
        <p className="mt-2 text-xs text-faint">{m.settings.hoursHint}</p>
      </Card>

      <Card>
        <CardHeader title={m.settings.appearance} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-medium text-muted">
              {m.settings.theme}
            </div>
            <div className="inline-flex overflow-hidden rounded-md border border-border">
              {(["dark", "light"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={cn(
                    "px-4 py-2 text-xs font-medium transition-colors",
                    theme === t
                      ? "bg-accent-soft text-accent"
                      : "text-muted hover:text-fg",
                  )}
                >
                  {t === "dark" ? m.settings.dark : m.settings.light}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-medium text-muted">
              {m.settings.language}
            </div>
            <LocaleSwitch locale={locale} />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title={m.settings.password} />
        <p className="text-sm leading-relaxed text-muted">
          {m.settings.passwordPhaseA}
        </p>
      </Card>

      <Card>
        <CardHeader title={m.settings.data} hint={m.settings.dataHint} />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={exportData}
            disabled={busy !== ""}
          >
            {busy === "export" ? m.common.saving : m.settings.export}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={busy !== ""}
          >
            {busy === "import" ? m.common.saving : m.settings.import}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importData(file);
            }}
          />

          <Button
            variant="danger"
            size="sm"
            onClick={reset}
            disabled={busy !== ""}
          >
            {busy === "reset" ? m.common.saving : m.settings.reset}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title={`${m.common.stage} / ${m.common.status}`} />
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-xs font-medium text-muted">
              {m.common.stage}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map((s) => (
                <span
                  key={s.id}
                  className="rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{ color: s.color, backgroundColor: s.soft }}
                  title={locale === "ar" ? s.hintAr : s.hint}
                >
                  {locale === "ar" ? s.labelAr : s.label}
                </span>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-medium text-muted">
              {m.common.status}
            </div>
            <ul className="space-y-1.5">
              {STATUSES.map((s) => (
                <li key={s.id} className="flex items-baseline gap-2 text-xs">
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 font-medium"
                    style={{ color: s.color, backgroundColor: s.soft }}
                  >
                    {s.id === "dead" ? "⛔ " : ""}
                    {locale === "ar" ? s.labelAr : s.label}
                  </span>
                  <span className="text-muted">
                    {locale === "ar" ? s.hintAr : s.hint}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] tracking-wide text-muted uppercase">
        {label}
      </div>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  );
}
