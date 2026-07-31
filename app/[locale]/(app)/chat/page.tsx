import { ChatView } from "@/components/chat/chat-view";
import { isLocale } from "@/lib/i18n/config";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ChatView locale={isLocale(locale) ? locale : "en"} />;
}
