import { NewClientForm } from "@/components/clients/new-client-form";
import { isLocale } from "@/lib/i18n/config";

export default async function NewClientPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <NewClientForm locale={isLocale(locale) ? locale : "en"} />;
}
