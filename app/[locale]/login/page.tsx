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
    <main className="jarvis-orbs relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div className="jarvis-grid absolute inset-0 z-0" aria-hidden />

      <div className="absolute top-4 z-20 flex items-center gap-2 ltr:right-4 rtl:left-4">
        <ThemeToggle />
        <LocaleSwitch locale={l} />
      </div>

      <div className="relative z-10 flex w-full justify-center">
        <Suspense fallback={null}>
          <LoginTiles locale={l} />
        </Suspense>
      </div>

      <footer className="absolute bottom-5 z-10 text-[11px] text-faint">
        {m.brand.agency}
      </footer>
    </main>
  );
}
