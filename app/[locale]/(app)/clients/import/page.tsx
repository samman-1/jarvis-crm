import { BulkImport } from "@/components/clients/bulk-import";
import { isLocale } from "@/lib/i18n/config";

export default async function ImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { locale } = await params;
  const { mode } = await searchParams;
  return (
    <BulkImport
      locale={isLocale(locale) ? locale : "en"}
      initialMode={
        mode === "activity" || mode === "tasks" ? mode : "clients"
      }
    />
  );
}
