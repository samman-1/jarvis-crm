import { CalendarView } from "@/components/calendar/calendar-view";
import { isLocale } from "@/lib/i18n/config";

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <CalendarView locale={isLocale(locale) ? locale : "en"} />;
}
