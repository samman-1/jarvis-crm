import { TeamView } from "@/components/team/team-view";
import { isLocale } from "@/lib/i18n/config";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <TeamView locale={isLocale(locale) ? locale : "en"} />;
}
