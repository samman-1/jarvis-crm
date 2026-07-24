"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSession } from "@/components/providers/session-provider";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { LocaleSwitch } from "@/components/shell/locale-switch";
import { CheckInControl } from "@/components/attendance/check-in-control";
import { Button } from "@/components/ui/primitives";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

function Icon({ path }: { path: string }) {
  return (
    <svg
      width="17"
      height="17"
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

const ICONS = {
  dashboard: "M3 12h4l3 8 4-16 3 8h4",
  clients: "M4 20v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M17 7h5M19.5 4.5v5",
  team: "M17 20v-1a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v1M10 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-1a3 3 0 0 0-2-2.8M16 5.2a3.5 3.5 0 0 1 0 6.6",
  calendar: "M7 3v3M17 3v3M3.5 9.5h17M4 6.5h16a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1Z",
  settings: "M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-1 1.47V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.6 1.6 0 0 0 9 4.6h.08A1.6 1.6 0 0 0 10 3.13V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.6 1.6 0 0 0 19.4 9v.08a1.6 1.6 0 0 0 1.47 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z",
  plus: "M12 5v14M5 12h14",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
};

export function AppShell({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const { m } = useI18n();
  const { member } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav: NavItem[] = [
    { href: `/${locale}/dashboard`, label: m.nav.dashboard, icon: <Icon path={ICONS.dashboard} /> },
    { href: `/${locale}/clients`, label: m.nav.clients, icon: <Icon path={ICONS.clients} /> },
    { href: `/${locale}/team`, label: m.nav.team, icon: <Icon path={ICONS.team} /> },
    { href: `/${locale}/calendar`, label: m.nav.calendar, icon: <Icon path={ICONS.calendar} /> },
    { href: `/${locale}/settings`, label: m.nav.settings, icon: <Icon path={ICONS.settings} /> },
  ];

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace(`/${locale}/login`);
    router.refresh();
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="flex min-h-screen bg-bg">
      {/* --- Sidebar ------------------------------------------------- */}
      <aside
        className={cn(
          "fixed inset-y-0 z-50 flex w-64 flex-col border-border bg-bg-elev transition-transform ltr:left-0 ltr:border-r rtl:right-0 rtl:border-l",
          "lg:sticky lg:top-0 lg:h-screen",
          // The off-canvas slide is a phone/tablet behaviour only — scoping it
          // to max-lg keeps it from fighting the desktop sticky layout.
          !mobileOpen &&
            "max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full",
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-5">
          <Link
            href={`/${locale}/dashboard`}
            className="flex items-center gap-2.5"
            onClick={() => setMobileOpen(false)}
          >
            <span className="size-2 animate-live rounded-full bg-accent" />
            <span className="font-display text-lg font-bold tracking-tight">
              {m.brand.name}
            </span>
            <span className="text-[10px] tracking-wide text-faint uppercase">
              {m.brand.system}
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="text-muted lg:hidden"
            aria-label={m.common.close}
          >
            <Icon path={ICONS.close} />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}

          <div className="pt-3">
            <Link
              href={`/${locale}/clients/new`}
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center gap-2 rounded-md bg-accent px-3 py-2.5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
            >
              <Icon path={ICONS.plus} />
              {m.nav.newClient}
            </Link>
          </div>
        </nav>

        <div className="shrink-0 border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold"
              style={{
                backgroundColor: `${member.color}1f`,
                color: member.color,
                boxShadow: `inset 0 0 0 1px ${member.color}55`,
              }}
            >
              {member.slot}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {locale === "ar" ? member.nameAr : member.name}
              </div>
              <div className="truncate text-[11px] text-faint">
                {locale === "ar" ? member.roleLabelAr : member.roleLabel}
              </div>
            </div>
            <button
              type="button"
              onClick={signOut}
              aria-label={m.nav.signOut}
              title={m.nav.signOut}
              className="shrink-0 text-faint transition-colors hover:text-critical"
            >
              <Icon path={ICONS.logout} />
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen ? (
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      ) : null}

      {/* --- Main ---------------------------------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur-md sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label={m.nav.dashboard}
            className="text-muted lg:hidden"
          >
            <Icon path={ICONS.menu} />
          </button>

          <div className="flex-1" />

          <CheckInControl />
          <ThemeToggle />
          <div className="hidden sm:block">
            <LocaleSwitch locale={locale} />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>

        <footer className="px-6 pb-6 text-center text-[11px] text-faint">
          {m.brand.agency}
          <span className="mx-2">·</span>
          <Link
            href={`/${locale}/settings`}
            className="underline-offset-2 hover:underline"
          >
            {m.settings.phaseNotice}
          </Link>
        </footer>
      </div>
    </div>
  );
}

export { Button };
