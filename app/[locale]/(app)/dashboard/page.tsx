import { Dashboard } from "@/components/dashboard/dashboard";
import { isLocale } from "@/lib/i18n/config";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <Dashboard locale={isLocale(locale) ? locale : "en"} />;
}
