"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSession } from "@/components/providers/session-provider";
import { useAsync, useMounted } from "@/lib/hooks/use-async";
import { db } from "@/lib/data";
import {
  Button,
  Card,
  MessageInput,
  Skeleton,
} from "@/components/ui/primitives";
import { MemberBadge } from "@/components/ui/badges";
import { PageHeader } from "@/components/shell/page-header";
import { PUBLIC_MEMBERS } from "@/lib/config/members";
import type { Message } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";
import { formatTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Team chat: one group thread plus a private thread with each of the others.
 *
 * This exists so a note about a client does not have to leave the system and
 * get lost in a WhatsApp group full of everything else.
 *
 * Laid out like a messaging app rather than like a form: the thread fills the
 * screen, the composer sits at the bottom and stays there, and consecutive
 * messages from the same person are grouped under one name with one timestamp
 * instead of repeating both on every line.
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
      <Card
        padded={false}
        className="flex h-[calc(100vh-17rem)] min-h-80 flex-col overflow-hidden lg:h-[calc(100vh-15rem)]"
      >
        {/* mt-auto on the inner block keeps a short conversation resting on
            the composer rather than stranded at the top of an empty card. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4 sm:px-4">
          <div className="mt-auto space-y-1">
          {messages.loading ? (
            <Skeleton className="h-32" />
          ) : (messages.data ?? []).length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
              <span aria-hidden className="text-2xl opacity-40">
                💬
              </span>
              <p className="text-xs text-faint">{m.chat.empty}</p>
            </div>
          ) : (
            (messages.data ?? []).map((msg, i, all) => {
              const mine = msg.fromId === user.id;
              const author = PUBLIC_MEMBERS.find((p) => p.id === msg.fromId);
              const prev = all[i - 1];
              const next = all[i + 1];

              // A run is the same person writing again within a few minutes.
              // Only the first of a run carries a name, only the last carries
              // a time, and the corner between them stays square so the run
              // reads as one block instead of three loose bubbles.
              const startsRun = !prev || prev.fromId !== msg.fromId || gap(prev, msg);
              const endsRun = !next || next.fromId !== msg.fromId || gap(msg, next);
              const showDay =
                !prev || dayKey(prev.sentAt) !== dayKey(msg.sentAt);

              return (
                <div key={msg.id}>
                  {showDay ? (
                    <div className="my-4 flex items-center gap-3">
                      <span className="h-px flex-1 bg-border" />
                      <span className="text-[10px] font-medium tracking-wide text-faint uppercase">
                        {dayLabel(msg.sentAt, locale)}
                      </span>
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  ) : null}

                  <div
                    className={cn(
                      "flex",
                      mine ? "justify-end" : "justify-start",
                      startsRun ? "mt-3" : "mt-0.5",
                    )}
                  >
                    <div className="flex max-w-[78%] flex-col">
                      {!mine && withId === null && author && startsRun ? (
                        <div
                          className="mb-1 ms-1 text-[11px] font-semibold"
                          style={{ color: author.color }}
                        >
                          {locale === "ar" ? author.nameAr : author.name}
                        </div>
                      ) : null}

                      <div
                        className={cn(
                          "rounded-2xl px-3.5 py-2",
                          mine
                            ? "bg-accent text-accent-fg"
                            : "border border-border bg-surface-2",
                          mine
                            ? endsRun
                              ? "rounded-ee-sm"
                              : "rounded-ee-2xl"
                            : endsRun
                              ? "rounded-es-sm"
                              : "rounded-es-2xl",
                        )}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {msg.body}
                        </p>
                      </div>

                      {endsRun ? (
                        <div
                          className={cn(
                            "tnum mt-1 text-[10px] text-faint",
                            mine ? "text-end me-1" : "text-start ms-1",
                          )}
                        >
                          {formatTime(msg.sentAt)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
            <div ref={bottom} />
          </div>
        </div>

        <form
          onSubmit={send}
          className="flex shrink-0 items-end gap-2 border-t border-border bg-bg-elev p-2.5"
        >
          <MessageInput
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={m.chat.placeholder}
            className="flex-1"
            onKeyDown={(e) => {
              // Enter sends on a keyboard. On a phone it inserts a line, the
              // way every messaging app people already use behaves.
              if (e.key === "Enter" && !e.shiftKey && !isTouch()) {
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

/** More than five minutes apart is a new run, not a continuation. */
function gap(a: Message, b: Message): boolean {
  return (
    new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime() > 5 * 60 * 1000
  );
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function dayLabel(iso: string, locale: Locale): string {
  const date = new Date(iso);
  const today = new Date();
  const key = dayKey(iso);
  if (key === dayKey(today.toISOString())) return locale === "ar" ? "اليوم" : "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (key === dayKey(yesterday.toISOString()))
    return locale === "ar" ? "أمس" : "Yesterday";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

function isTouch(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}
