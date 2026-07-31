import { RemindersPage } from "@/components/reminders/reminders-page";
import { isLocale } from "@/lib/i18n/config";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <RemindersPage locale={isLocale(locale) ? locale : "en"} />;
}
