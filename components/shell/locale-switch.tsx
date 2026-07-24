"use client";

import { usePathname, useRouter } from "next/navigation";
import { LOCALES, LOCALE_LABEL, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/** Swaps the locale segment in place, keeping the user on the same page. */
export function LocaleSwitch({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const router = useRouter();

  function switchTo(next: Locale) {
    if (next === locale) return;
    const segments = pathname.split("/");
    segments[1] = next;
    router.push(segments.join("/") || `/${next}`);
    router.refresh();
  }

  return (
    <div className="inline-flex overflow-hidden rounded-md border border-border bg-surface">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          aria-current={l === locale}
          className={cn(
            "px-2.5 py-2 text-xs font-medium transition-colors",
            l === locale
              ? "bg-accent-soft text-accent"
              : "text-muted hover:text-fg",
          )}
        >
          {l === "ar" ? LOCALE_LABEL.ar : "EN"}
        </button>
      ))}
    </div>
  );
}
