"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSession } from "@/components/providers/session-provider";
import { LocaleSwitch } from "@/components/shell/locale-switch";
import type { Locale } from "@/lib/i18n/config";

/**
 * The phone's way out.
 *
 * On a laptop the sidebar carries the member card, Settings and Sign out. The
 * sidebar is `hidden lg:flex`, so on a phone all three were unreachable: you
 * could log in and never log out. This puts them behind the avatar in the
 * header, which is the place a thumb looks for them anyway.
 *
 * It is `lg:hidden` on purpose. Above that width the sidebar already shows the
 * same three things, and two sign-out buttons on one screen is one too many.
 */
export function AccountMenu({
  locale,
  onSignOut,
}: {
  locale: Locale;
  onSignOut: () => void;
}) {
  const { m } = useI18n();
  const { member } = useSession();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  /* A tap anywhere else, or Escape, closes it. Without this the panel would
     sit over the page until you happened to hit the avatar again. */
  useEffect(() => {
    if (!open) return;

    function onPointer(e: PointerEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative shrink-0 lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={locale === "ar" ? member.nameAr : member.name}
        className="flex size-9 items-center justify-center rounded-full font-display text-xs font-bold"
        style={{
          backgroundColor: `${member.color}1f`,
          color: member.color,
          boxShadow: `inset 0 0 0 1px ${member.color}55`,
        }}
      >
        {member.initials}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute top-full z-50 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-bg-elev shadow-lg ltr:right-0 rtl:left-0"
        >
          <div className="truncate border-b border-border px-3 py-2.5 text-sm font-medium">
            {locale === "ar" ? member.nameAr : member.name}
          </div>

          <Link
            href={`/${locale}/settings`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <MenuIcon path="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-1 1.47V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.6 1.6 0 0 0 9 4.6h.08A1.6 1.6 0 0 0 10 3.13V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.6 1.6 0 0 0 19.4 9v.08a1.6 1.6 0 0 0 1.47 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
            {m.nav.settings}
          </Link>

          {/* The language switch is `hidden sm:block` in the header, so a phone
              could not reach Arabic either. It can from here. */}
          <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2.5">
            <span className="text-sm text-muted">{m.settings.language}</span>
            <LocaleSwitch locale={locale} />
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="flex w-full items-center gap-2.5 border-t border-border px-3 py-2.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-critical"
          >
            <MenuIcon path="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            {m.nav.signOut}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MenuIcon({ path }: { path: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      <path d={path} />
    </svg>
  );
}
