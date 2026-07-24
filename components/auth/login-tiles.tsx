"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button, Input } from "@/components/ui/primitives";
import { PUBLIC_MEMBERS, type PublicMember } from "@/lib/config/members";
import { cn } from "@/lib/utils";

/**
 * Pick a face, then type a password. No email, no username — with three
 * people, asking them to type an address every morning is friction for
 * nothing.
 */
export function LoginTiles({ locale }: { locale: string }) {
  const { m } = useI18n();
  const router = useRouter();
  const params = useSearchParams();

  const [selected, setSelected] = useState<PublicMember | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selected) inputRef.current?.focus();
  }, [selected]);

  function choose(member: PublicMember) {
    setSelected(member);
    setPassword("");
    setError("");
  }

  function back() {
    setSelected(null);
    setPassword("");
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (!password) {
      setError(m.login.empty);
      return;
    }

    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot: selected.slot, password }),
      });

      if (!res.ok) {
        setError(m.login.wrong);
        setPassword("");
        inputRef.current?.focus();
        return;
      }

      const next = params.get("next");
      router.replace(next && next.startsWith("/") ? next : `/${locale}/dashboard`);
      router.refresh();
    } catch {
      setError(m.login.wrong);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-3xl">
      <div className="mb-10 text-center">
        <div className="mb-3 inline-flex items-center gap-2.5">
          <span className="size-2 animate-live rounded-full bg-accent" />
          <span className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {m.brand.name}
          </span>
        </div>
        <p className="text-sm text-muted">
          {selected ? m.login.passwordFor : m.login.title}
          {selected ? (
            <span className="font-medium" style={{ color: selected.color }}>
              {" "}
              {locale === "ar" ? selected.nameAr : selected.name}
            </span>
          ) : null}
        </p>
      </div>

      {!selected ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {PUBLIC_MEMBERS.map((member, i) => (
            <button
              key={member.id}
              type="button"
              onClick={() => choose(member)}
              className={cn(
                "group animate-enter relative overflow-hidden rounded-lg border border-border",
                "bg-surface p-6 text-center transition-all",
                "hover:-translate-y-0.5 hover:border-border-strong hover:shadow-float",
                "focus-visible:border-accent",
              )}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-0.5 opacity-60 transition-opacity group-hover:opacity-100"
                style={{ background: member.color }}
              />
              <span
                className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full font-display text-2xl font-bold transition-transform group-hover:scale-105"
                style={{
                  backgroundColor: `${member.color}1f`,
                  color: member.color,
                  boxShadow: `inset 0 0 0 1px ${member.color}55`,
                }}
              >
                {member.initials}
              </span>
              <span className="block font-display text-base font-semibold">
                {locale === "ar" ? member.nameAr : member.name}
              </span>

            </button>
          ))}
        </div>
      ) : (
        <form
          onSubmit={submit}
          className="animate-enter mx-auto w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-float"
        >
          <div className="mb-5 flex items-center gap-3">
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-full font-display text-lg font-bold"
              style={{
                backgroundColor: `${selected.color}1f`,
                color: selected.color,
                boxShadow: `inset 0 0 0 1px ${selected.color}55`,
              }}
            >
              {selected.initials}
            </span>
            <div className="min-w-0">
              <div className="font-display text-sm font-semibold">
                {locale === "ar" ? selected.nameAr : selected.name}
              </div>

            </div>
          </div>

          <Input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={m.login.password}
            autoComplete="current-password"
            aria-label={m.login.password}
            aria-invalid={Boolean(error)}
            disabled={busy}
          />

          {error ? (
            <p className="mt-2 text-xs text-critical" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            className="mt-4 w-full"
            disabled={busy}
          >
            {busy ? m.login.signingIn : m.login.enter}
          </Button>

          <button
            type="button"
            onClick={back}
            className="mt-3 w-full text-center text-xs text-faint transition-colors hover:text-fg"
          >
            {m.login.notYou}
          </button>
        </form>
      )}

      <p className="mt-10 text-center text-[11px] text-faint">
        {m.login.hint}
      </p>
    </div>
  );
}
