import { SettingsView } from "@/components/settings/settings-view";
import { isLocale } from "@/lib/i18n/config";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <SettingsView locale={isLocale(locale) ? locale : "en"} />;
}
