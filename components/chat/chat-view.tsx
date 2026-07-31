"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSession } from "@/components/providers/session-provider";
import { useAsync, useMounted } from "@/lib/hooks/use-async";
import { db } from "@/lib/data";
import { Button, Card, Skeleton, Textarea } from "@/components/ui/primitives";
import { MemberBadge } from "@/components/ui/badges";
import { PageHeader } from "@/components/shell/page-header";
import { PUBLIC_MEMBERS } from "@/lib/config/members";
import type { Message } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Team chat: one group thread plus a private thread with each of the others.
 *
 * This exists so a note about a client does not have to leave the system and
 * get lost in a WhatsApp group full of everything else.
 *
 * Honest limitation while there is no database: messages are stored on the
 * sender's own device, so nothing actually reaches anyone. The banner says so
 * plainly rather than letting someone type into a void believing otherwise.
 */
export function ChatView({ locale }: { locale: Locale }) {
  const { m } = useI18n();
  const { user } = useSession();
  const mounted = useMounted();

  const [withId, setWithId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const threads = useAsync(
    () => (mounted ? db().listThreads(user.id) : Promise.resolve([])),
    [mounted, user.id],
  );

  const messages = useAsync(
    () =>
      mounted ? db().listMessages(user.id, withId) : Promise.resolve([] as Message[]),
    [mounted, user.id, withId],
  );

  const isLocalOnly = mounted && db().mode === "mock";

  useEffect(() => {
    if (!mounted) return;
    void db().markThreadRead(user.id, withId);
    bottom.current?.scrollIntoView({ block: "end" });
  }, [mounted, user.id, withId, messages.data]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      await db().sendMessage(user.id, withId, body.trim());
      setBody("");
      messages.reload();
      threads.reload();
    } finally {
      setBusy(false);
    }
  }

  const tabs: { id: string | null; label: string; color?: string }[] = [
    { id: null, label: m.chat.group },
    ...PUBLIC_MEMBERS.filter((p) => p.id !== user.id).map((p) => ({
      id: p.id,
      label: locale === "ar" ? p.nameAr : p.name,
      color: p.color,
    })),
  ];

  return (
    <div className="space-y-4">
      <PageHeader title={m.chat.title} subtitle={m.chat.subtitle} />

      {isLocalOnly ? (
        <div className="rounded-lg border border-warn bg-warn-soft p-3.5">
          <div className="mb-1 text-[11px] font-semibold tracking-wide text-warn uppercase">
            {m.chat.notLiveTitle}
          </div>
          <p className="text-sm leading-relaxed">{m.chat.notLiveBody}</p>
        </div>
      ) : null}

      {/* --- Thread picker -------------------------------------------- */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const summary = (threads.data ?? []).find((t) => t.withId === tab.id);
          const active = withId === tab.id;
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => setWithId(tab.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-md border px-3.5 py-2.5 text-sm font-medium transition-colors",
                active ? "border-transparent" : "border-border text-muted hover:text-fg",
              )}
              style={
                active
                  ? {
                      backgroundColor: `${tab.color ?? "var(--accent)"}1f`,
                      color: tab.color ?? "var(--accent)",
                      borderColor: tab.color ?? "var(--accent)",
                    }
                  : undefined
              }
            >
              {tab.id ? <MemberBadge memberId={tab.id} size="xs" /> : <span>👥</span>}
              {tab.label}
              {summary?.unread ? (
                <span className="tnum rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-accent-fg">
                  {summary.unread}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* --- Messages -------------------------------------------------- */}
      <Card padded={false} className="flex min-h-[50vh] flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.loading ? (
            <Skeleton className="h-32" />
          ) : (messages.data ?? []).length === 0 ? (
            <p className="py-10 text-center text-xs text-faint">
              {m.chat.empty}
            </p>
          ) : (
            (messages.data ?? []).map((msg) => {
              const mine = msg.fromId === user.id;
              const author = PUBLIC_MEMBERS.find((p) => p.id === msg.fromId);
              return (
                <div
                  key={msg.id}
                  className={cn("flex", mine ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-3.5 py-2.5",
                      mine ? "bg-accent text-accent-fg" : "bg-surface-2",
                    )}
                  >
                    {!mine && withId === null && author ? (
                      <div
                        className="mb-0.5 text-[11px] font-semibold"
                        style={{ color: author.color }}
                      >
                        {locale === "ar" ? author.nameAr : author.name}
                      </div>
                    ) : null}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.body}
                    </p>
                    <div
                      className={cn(
                        "tnum mt-1 text-[10px]",
                        mine ? "text-accent-fg/70" : "text-faint",
                      )}
                    >
                      {formatDateTime(msg.sentAt, locale)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottom} />
        </div>

        <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={m.chat.placeholder}
            className="max-h-32 min-h-11 flex-1 py-2.5"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(e);
              }
            }}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={busy || !body.trim()}
            className="h-11 shrink-0"
          >
            {m.chat.send}
          </Button>
        </form>
      </Card>
    </div>
  );
}
