"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { type Locale, dirFor } from "@/lib/i18n/config";
import { MESSAGES, type Messages } from "@/lib/i18n/messages";

interface I18nValue {
  locale: Locale;
  dir: "ltr" | "rtl";
  isRtl: boolean;
  m: Messages;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const value = useMemo<I18nValue>(
    () => ({
      locale,
      dir: dirFor(locale),
      isRtl: locale === "ar",
      m: MESSAGES[locale],
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

/** Picks the right field off a config object that carries both languages. */
export function useLocalised() {
  const { locale } = useI18n();
  return function pick<T extends Record<string, unknown>>(
    obj: T,
    key: string,
  ): string {
    if (locale === "ar") {
      const arKey = `${key}Ar`;
      const value = obj[arKey];
      if (typeof value === "string" && value) return value;
    }
    const base = obj[key];
    return typeof base === "string" ? base : "";
  };
}
