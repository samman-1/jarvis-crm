import { Suspense } from "react";
import { LoginTiles } from "@/components/auth/login-tiles";
import { LocaleSwitch } from "@/components/shell/locale-switch";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { MESSAGES } from "@/lib/i18n/messages";
import { isLocale } from "@/lib/i18n/config";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const l = isLocale(locale) ? locale : "en";
  const m = MESSAGES[l];

  return (
    <main className="jarvis-orbs relative flex min-h-screen flex-col overflow-hidden px-4">
      <div className="jarvis-grid absolute inset-0 z-0" aria-hidden />

      {/*
        A row in the layout, not a box floating over it. Absolutely positioned,
        these controls landed on top of the wordmark on a phone, because the
        tiles are centred in whatever height is left and on a short screen that
        put JARVIS directly under them.
      */}
      <header className="relative z-20 flex shrink-0 items-center justify-end gap-2 py-4">
        <ThemeToggle />
        <LocaleSwitch locale={l} />
      </header>

      <div className="relative z-10 flex w-full flex-1 items-center justify-center py-4">
        <Suspense fallback={null}>
          <LoginTiles locale={l} />
        </Suspense>
      </div>

      <footer className="relative z-10 shrink-0 pb-5 text-center text-[11px] text-faint">
        {m.brand.agency}
      </footer>
    </main>
  );
}
