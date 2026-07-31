"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSession } from "@/components/providers/session-provider";
import { Button, Textarea } from "@/components/ui/primitives";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/**
 * Ask Jarvis: the assistant, reachable from every page.
 *
 * Private per member, and private per device. The conversation is kept in
 * this browser's storage under the member's own key and is never written to
 * the shared database, so the other two cannot read what you asked. What
 * leaves the device is one request to our server, which adds a snapshot of
 * your own CRM before calling OpenAI.
 *
 * It can read and it can write text. It cannot change the CRM: nothing here
 * creates a client, logs a visit or moves a stage. That is deliberate for a
 * first version, because a wrong answer should cost a re-read, not a record.
 */

interface Turn {
  role: "user" | "assistant";
  content: string;
}

const KEY = (memberId: string) => `jarvis.ask.${memberId}`;
const MAX_KEPT = 40;

export function AskJarvis({ locale }: { locale: Locale }) {
  const { m } = useI18n();
  const { user } = useSession();

  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Read after mount only: localStorage does not exist during the render on
  // the server, and reading it during hydration is what caused the mismatch
  // this app has already been bitten by once.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY(user.id));
      if (raw) setTurns(JSON.parse(raw) as Turn[]);
    } catch {
      /* corrupt or unavailable storage just means an empty conversation */
    }
    setLoaded(true);
  }, [user.id]);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(
        KEY(user.id),
        JSON.stringify(turns.slice(-MAX_KEPT)),
      );
    } catch {
      /* storage full or blocked: the conversation still works, it just will
         not survive a reload */
    }
  }, [turns, user.id, loaded]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [turns, open, busy]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;

    const next = [...turns, { role: "user" as const, content: question }];
    setTurns(next);
    setDraft("");
    setError("");
    setBusy(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        reply?: string;
        error?: string;
        detail?: string;
      };

      if (res.ok && data.reply) {
        setTurns((t) => [...t, { role: "assistant", content: data.reply! }]);
      } else if (data.error === "no_api_key") {
        setError(m.ask.notConfigured);
      } else {
        setError(data.detail || m.ask.failed);
      }
    } catch {
      setError(m.ask.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Sits above the phone navigation bar, out of the thumb's way but
          reachable without leaving whatever page you are reading. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={m.ask.title}
        className={cn(
          "fixed z-40 flex items-center gap-2 rounded-full bg-accent px-4 py-3 text-accent-fg shadow-lg transition-transform hover:bg-accent-hover active:scale-95",
          "bottom-20 lg:bottom-6",
          locale === "ar" ? "start-4" : "end-4",
          open && "hidden",
        )}
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <SparkIcon />
        <span className="text-xs font-semibold">{m.ask.short}</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-bg/60 backdrop-blur-sm sm:items-end sm:justify-end sm:p-6">
          <div className="mt-auto flex h-[85vh] w-full flex-col overflow-hidden rounded-t-xl border border-border bg-bg-elev shadow-lg sm:mt-0 sm:h-[36rem] sm:max-w-md sm:rounded-xl">
            <header className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-3">
              <span className="text-accent">
                <SparkIcon />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{m.ask.title}</div>
                <div className="truncate text-[11px] text-faint">
                  {m.ask.private}
                </div>
              </div>
              {turns.length ? (
                <button
                  type="button"
                  onClick={() => {
                    setTurns([]);
                    setError("");
                  }}
                  className="text-[11px] text-faint transition-colors hover:text-critical"
                >
                  {m.ask.clear}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={m.common.close}
                className="ms-1 text-faint transition-colors hover:text-fg"
              >
                ✕
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {turns.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm leading-relaxed text-muted">
                    {m.ask.intro}
                  </p>
                  <div className="space-y-1.5">
                    {m.ask.examples.map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => send(example)}
                        className="block w-full rounded-md border border-border bg-surface-2 px-3 py-2.5 text-start text-xs text-muted transition-colors hover:border-accent hover:text-fg"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {turns.map((turn, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                    turn.role === "user"
                      ? "ms-auto bg-accent text-accent-fg"
                      : "me-auto border border-border bg-surface-2",
                  )}
                >
                  {turn.content}
                </div>
              ))}

              {busy ? (
                <div className="me-auto flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
                  <span className="size-1.5 animate-live rounded-full bg-accent" />
                  <span className="text-xs text-faint">{m.ask.thinking}</span>
                </div>
              ) : null}

              {error ? (
                <p className="rounded-md border border-critical bg-critical-soft px-3 py-2 text-xs leading-relaxed">
                  {error}
                </p>
              ) : null}

              <div ref={endRef} />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(draft);
              }}
              className="shrink-0 border-t border-border p-3"
              style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
            >
              <div className="flex items-end gap-2">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter sends; Shift+Enter is a new line. On a phone the
                    // keyboard's own return key inserts a line as usual.
                    if (e.key === "Enter" && !e.shiftKey && !isTouch()) {
                      e.preventDefault();
                      void send(draft);
                    }
                  }}
                  placeholder={m.ask.placeholder}
                  className="max-h-32 min-h-11 flex-1 resize-none py-2.5"
                  rows={1}
                />
                <Button
                  type="submit"
                  variant="primary"
                  disabled={busy || !draft.trim()}
                  className="h-11 shrink-0"
                >
                  {m.chat.send}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function isTouch(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

function SparkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4 shrink-0"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2z" />
      <path d="M18.5 14.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6z" />
    </svg>
  );
}
