"use client";

import { useAsync, useMounted } from "@/lib/hooks/use-async";
import { db } from "@/lib/data";
import { PageHeader } from "@/components/shell/page-header";
import { RemindersPanel } from "@/components/reminders/reminders";
import { useI18n } from "@/components/providers/i18n-provider";
import type { Locale } from "@/lib/i18n/config";

export function RemindersPage({ locale }: { locale: Locale }) {
  const { m } = useI18n();
  const mounted = useMounted();
  const clients = useAsync(
    () => (mounted ? db().listClients() : Promise.resolve([])),
    [mounted],
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={m.reminders.title} subtitle={m.reminders.hint} />
      <RemindersPanel locale={locale} clients={clients.data ?? []} />
    </div>
  );
}
