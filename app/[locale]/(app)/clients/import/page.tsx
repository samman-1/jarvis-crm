import { BulkImport } from "@/components/clients/bulk-import";
import { isLocale } from "@/lib/i18n/config";

export default async function ImportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <BulkImport locale={isLocale(locale) ? locale : "en"} />;
}
