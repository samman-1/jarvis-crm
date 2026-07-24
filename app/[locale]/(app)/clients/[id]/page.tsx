import { ClientDetail } from "@/components/clients/client-detail";
import { isLocale } from "@/lib/i18n/config";

export default async function ClientPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  return <ClientDetail clientId={id} locale={isLocale(locale) ? locale : "en"} />;
}
