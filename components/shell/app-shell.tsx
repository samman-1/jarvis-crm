"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSession } from "@/components/providers/session-provider";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { LocaleSwitch } from "@/components/shell/locale-switch";
import { AskJarvis } from "@/components/ai/ask-jarvis";
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
  bell: "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  chat: "M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-4-.9L3 21l1.9-4.9A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4Z",
  stack: "M12 3 3 8l9 5 9-5-9-5ZM3 16l9 5 9-5M3 12l9 5 9-5",
  route: "M9 20 3 17V4l6 3 6-3 6 3v13l-6-3-6 3ZM9 7v13M15 4v13",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
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

  const nav: NavItem[] = [
    { href: `/${locale}/dashboard`, label: m.nav.dashboard, icon: <Icon path={ICONS.dashboard} /> },
    { href: `/${locale}/clients`, label: m.nav.clients, icon: <Icon path={ICONS.clients} /> },
    { href: `/${locale}/team`, label: m.nav.team, icon: <Icon path={ICONS.team} /> },
    { href: `/${locale}/calendar`, label: m.nav.calendar, icon: <Icon path={ICONS.calendar} /> },
    { href: `/${locale}/routes`, label: m.nav.routes, icon: <Icon path={ICONS.route} /> },
    { href: `/${locale}/reminders`, label: m.nav.reminders, icon: <Icon path={ICONS.bell} /> },
    { href: `/${locale}/chat`, label: m.nav.chat, icon: <Icon path={ICONS.chat} /> },
    { href: `/${locale}/settings`, label: m.nav.settings, icon: <Icon path={ICONS.settings} /> },
  ];

  /** Five is all a thumb bar can hold without the labels colliding. */
  const phoneNav = [nav[0], nav[1], nav[4], nav[3], nav[6]].filter(Boolean);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace(`/${locale}/login`);
    router.refresh();
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="relative flex min-h-screen">
      {/* The background is painted by <body>; this layer only lights it.
          Everything after it carries z-10 so nothing can fall behind. */}
      <JarvisBackground />

      {/* --- Sidebar ------------------------------------------------- */}
      <aside className="sticky top-0 z-10 hidden h-screen w-64 shrink-0 flex-col border-border bg-bg-elev/95 ltr:border-r rtl:border-l lg:flex">
        <div className="flex h-16 shrink-0 items-center px-5">
          <Link href={`/${locale}/dashboard`} className="flex items-center gap-2.5">
            <span className="size-2 animate-live rounded-full bg-accent" />
            <span className="font-display text-lg font-bold tracking-tight">
              {m.brand.name}
            </span>
            <span className="text-[10px] tracking-wide text-faint uppercase">
              {m.brand.system}
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
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
              className="flex items-center justify-center gap-2 rounded-md bg-accent px-3 py-2.5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
            >
              <Icon path={ICONS.plus} />
              {m.nav.newClient}
            </Link>
            <Link
              href={`/${locale}/clients/import`}
              className="mt-2 flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:border-border-strong hover:text-fg"
            >
              <Icon path={ICONS.stack} />
              {m.nav.import}
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
              {member.initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {locale === "ar" ? member.nameAr : member.name}
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

      {/* --- Main ---------------------------------------------------- */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur-md sm:h-16 sm:px-6">
          {/* On a phone the wordmark replaces the hamburger — navigation
              lives in the bottom bar where a thumb can reach it. */}
          <Link
            href={`/${locale}/dashboard`}
            className="flex items-center gap-2 lg:hidden"
          >
            <span className="size-1.5 animate-live rounded-full bg-accent" />
            <span className="font-display text-base font-bold tracking-tight">
              {m.brand.name}
            </span>
          </Link>

          <div className="flex-1" />

          <Link
            href={`/${locale}/clients/new`}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-medium text-accent-fg transition-colors hover:bg-accent-hover lg:hidden"
          >
            <Icon path={ICONS.plus} />
            {m.nav.newClient}
          </Link>

          <ThemeToggle />
          <div className="hidden sm:block">
            <LocaleSwitch locale={locale} />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-5 pb-24 sm:px-6 sm:py-8 lg:pb-8">
          {children}
        </main>

        <footer className="hidden px-6 pb-6 text-center text-[11px] text-faint lg:block">
          {m.brand.agency}
        </footer>
      </div>

      {/* --- Phone navigation ---------------------------------------- */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-bg-elev/95 backdrop-blur-md lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {phoneNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
              isActive(item.href) ? "text-accent" : "text-faint",
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Reachable from every page, because the question usually arrives
          while you are looking at something else. */}
      <AskJarvis locale={locale} />
    </div>
  );
}

/**
 * The moving light behind the app.
 *
 * Four elements, no state, no JavaScript, no listeners. It is fixed to the
 * viewport and marked pointer-events-none, so it cannot catch a tap, cannot
 * affect scrolling, and cannot push anything out of place. Everything it does
 * is transform and opacity, which the compositor handles without asking the
 * page to lay out again.
 *
 * `aria-hidden` keeps it out of the accessibility tree entirely: it is
 * decoration, and a screen reader has nothing to say about it.
 */
function JarvisBackground() {
  return (
    <div className="jarvis-bg" aria-hidden>
      <span className="orb-a" />
      <span className="orb-b" />
      <span className="orb-c" />
      <span className="sweep" />
    </div>
  );
}

export { Button };
