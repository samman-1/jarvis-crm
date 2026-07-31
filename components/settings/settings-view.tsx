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
  Input,
} from "@/components/ui/primitives";
import { LocaleSwitch } from "@/components/shell/locale-switch";
import { PageHeader } from "@/components/shell/page-header";
import { MemberBadge } from "@/components/ui/badges";
import { ProfileEditor } from "@/components/settings/profile-editor";
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

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title={m.settings.title} />

      <ProfileEditor locale={locale} />

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

      <PasswordCard />

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

/**
 * Change your own password.
 *
 * Everyone started on a password Sammoni generated and sent over WhatsApp,
 * which means it was never really private. Setting one here replaces it with
 * a hash only you can satisfy.
 */
function PasswordCard() {
  const { m } = useI18n();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDone(false);

    if (next.length < 8) return setError(m.settings.passwordShort);
    if (next !== repeat) return setError(m.settings.passwordMismatch);

    setBusy(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ current, next }),
      });
      if (res.ok) {
        setCurrent("");
        setNext("");
        setRepeat("");
        setDone(true);
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(
        body.error === "wrong_password"
          ? m.settings.passwordWrong
          : body.error === "too_short"
            ? m.settings.passwordShort
            : body.error === "not_saved"
              ? m.settings.passwordNotSaved
              : m.common.error,
      );
    } catch {
      setError(m.common.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title={m.settings.password} hint={m.settings.passwordHint} />
      <form onSubmit={submit} className="space-y-3">
        <Input
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder={m.settings.currentPassword}
          aria-label={m.settings.currentPassword}
          className="h-11"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder={m.settings.newPassword}
            aria-label={m.settings.newPassword}
            className="h-11"
          />
          <Input
            type="password"
            autoComplete="new-password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            placeholder={m.settings.repeatPassword}
            aria-label={m.settings.repeatPassword}
            className="h-11"
          />
        </div>

        {error ? (
          <p className="text-sm text-critical">{error}</p>
        ) : done ? (
          <p className="text-sm text-success">{m.settings.passwordChanged}</p>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={busy || !current || !next || !repeat}
        >
          {busy ? m.common.saving : m.settings.changePassword}
        </Button>
      </form>
    </Card>
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
