import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { SessionProvider } from "@/components/providers/session-provider";
import { AppShell } from "@/components/shell/app-shell";
import { isLocale } from "@/lib/i18n/config";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const l = isLocale(locale) ? locale : "en";

  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);

  // Middleware already guards this, but a layout that assumes a session
  // without checking is one refactor away from leaking the whole CRM.
  if (!session) redirect(`/${l}/login`);

  return (
    <SessionProvider user={session}>
      <AppShell locale={l}>{children}</AppShell>
    </SessionProvider>
  );
}
