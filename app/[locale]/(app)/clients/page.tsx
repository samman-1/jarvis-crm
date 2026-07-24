import { ClientsBoard } from "@/components/clients/clients-board";
import { isLocale } from "@/lib/i18n/config";

export default async function ClientsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ClientsBoard locale={isLocale(locale) ? locale : "en"} />;
}
