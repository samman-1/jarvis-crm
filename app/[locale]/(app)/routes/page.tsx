import { RoutePlanner } from "@/components/routes/route-planner";
import { isLocale } from "@/lib/i18n/config";

export default async function RoutesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <RoutePlanner locale={isLocale(locale) ? locale : "en"} />;
}
