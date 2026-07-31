import type { Metadata, Viewport } from "next";
import {
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  IBM_Plex_Sans_Arabic,
  Space_Grotesk,
} from "next/font/google";
import { notFound } from "next/navigation";
import "@/app/globals.css";
import { DEFAULT_LOCALE, LOCALES, dirFor, isLocale } from "@/lib/i18n/config";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { ThemeProvider, themeScript } from "@/components/providers/theme-provider";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--f-display",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const body = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--f-body",
  weight: ["400", "500", "600"],
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--f-mono",
  weight: ["400", "500"],
  display: "swap",
});

const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--f-ar",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Jarvis CRM",
  description:
    "Jarvis AI Agency internal client and team tracking system. Private.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b0a08",
  width: "device-width",
  initialScale: 1,
};

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html
      lang={locale}
      dir={dirFor(locale)}
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${mono.variable} ${arabic.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <I18nProvider locale={locale}>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

export const dynamicParams = false;
export { DEFAULT_LOCALE };
