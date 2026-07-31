"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSession } from "@/components/providers/session-provider";
import { useAsync, useMounted } from "@/lib/hooks/use-async";
import { db } from "@/lib/data";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Select,
  Skeleton,
} from "@/components/ui/primitives";
import {
  FreshnessChip,
  MemberBadge,
  StageChip,
  StatusChip,
} from "@/components/ui/badges";
import { PageHeader } from "@/components/shell/page-header";
import { STAGES, STATUSES, type Stage } from "@/lib/config/stages";
import { PUBLIC_MEMBERS } from "@/lib/config/members";
import type { ClientRow } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";
import { formatSar } from "@/lib/utils";
import { cn } from "@/lib/utils";

type View = "table" | "board";

/**
 * Everything all three members have touched, in one place.
 *
 * Sorted by activity recency by default, because the question this page
 * answers on a Sunday morning is "what is warm?", not "what is alphabetical?".
 */
export function ClientsBoard({ locale }: { locale: Locale }) {
  const { m } = useI18n();
  const { user } = useSession();
  const mounted = useMounted();

  const [view, setView] = useState<View>("table");
  const [search, setSearch] = useState("");
  // Your own clients by default. Seeing all of everyone's at once was
  // overwhelming; the toggle below opens it up when you need it.
  const [owner, setOwner] = useState(user.id);
  const [stage, setStage] = useState("");
  const [status, setStatus] = useState("");
  const [staleOnly, setStaleOnly] = useState(false);
  const [deadOnly, setDeadOnly] = useState(false);

  const { data, loading } = useAsync(
    () => (mounted ? db().listClients() : Promise.resolve([])),
    [mounted],
  );

  const all = useMemo(() => data ?? [], [data]);

  const rows = useMemo(() => {
    let out = all;
    if (deadOnly) out = out.filter((c) => c.status === "dead");
    if (owner)
      out = out.filter(
        (c) => c.ownerId === owner || c.collaboratorIds.includes(owner),
      );
    if (stage) out = out.filter((c) => c.stage === stage);
    if (status) out = out.filter((c) => c.status === status);
    if (staleOnly) out = out.filter((c) => c.isStale);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      out = out.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.nameAr.includes(q) ||
          c.city.toLowerCase().includes(q) ||
          c.industry.toLowerCase().includes(q) ||
          (c.primaryContact?.name.toLowerCase().includes(q) ?? false),
      );
    }
    return out;
  }, [all, owner, stage, status, staleOnly, deadOnly, search]);

  const deadCount = all.filter((c) => c.status === "dead").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title={owner === user.id ? m.clients.mineTitle : m.clients.title}
        subtitle={owner === user.id ? m.clients.mineSubtitle : m.clients.subtitle}
        action={
          <div className="flex items-center gap-2">
            <div className="hidden overflow-hidden rounded-md border border-border sm:flex">
              {(["table", "board"] as View[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn(
                    "px-3 py-2 text-xs font-medium transition-colors",
                    view === v
                      ? "bg-accent-soft text-accent"
                      : "text-muted hover:text-fg",
                  )}
                >
                  {v === "table" ? m.clients.table : m.clients.board}
                </button>
              ))}
            </div>
            <Link href={`/${locale}/clients/new`}>
              <Button size="sm" variant="primary">
                {m.nav.newClient}
              </Button>
            </Link>
          </div>
        }
      />

      {/* --- Do-not-approach shortcut --------------------------------- */}
      {deadCount > 0 ? (
        <button
          type="button"
          onClick={() => {
            setDeadOnly((v) => !v);
            setStatus("");
          }}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-start transition-colors",
            deadOnly
              ? "border-critical bg-critical-soft"
              : "border-border bg-surface hover:border-critical",
          )}
        >
          <span className="text-lg">⛔</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
              {m.clients.deadList}
              <span className="tnum ms-2 text-critical">{deadCount}</span>
            </span>
            <span className="block text-xs text-muted">
              {m.clients.deadListHint}
            </span>
          </span>
          <span className="text-xs text-faint">
            {deadOnly ? m.common.close : m.common.open}
          </span>
        </button>
      ) : null}

      {/* --- Mine / Everyone ------------------------------------------ */}
      <div className="flex overflow-hidden rounded-md border border-border">
        {[
          { id: user.id, label: m.common.mine },
          { id: "", label: m.common.everyone },
        ].map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => setOwner(opt.id)}
            className={cn(
              "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
              owner === opt.id
                ? "bg-accent-soft text-accent"
                : "text-muted hover:text-fg",
            )}
          >
            {opt.label}
            <span className="tnum ms-2 text-xs opacity-70">
              {opt.id
                ? all.filter(
                    (c) => c.ownerId === user.id || c.collaboratorIds.includes(user.id),
                  ).length
                : all.length}
            </span>
          </button>
        ))}
      </div>

      {/* --- Filters -------------------------------------------------- */}
      <Card padded={false} className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={m.nav.search}
            className="h-9 min-w-40 flex-1 text-xs sm:min-w-56"
          />
          <Select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="h-9 !w-44 text-xs"
            aria-label={m.clients.filterOwner}
          >
            <option value="">{m.clients.filterOwner}: {m.common.everyone}</option>
            {PUBLIC_MEMBERS.map((p) => (
              <option key={p.id} value={p.id}>
                {locale === "ar" ? p.nameAr : p.name}
                {p.id === user.id ? ` (${m.common.you})` : ""}
              </option>
            ))}
          </Select>
          <Select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="h-9 !w-40 text-xs"
            aria-label={m.clients.filterStage}
          >
            <option value="">{m.clients.filterStage}: {m.common.all}</option>
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {locale === "ar" ? s.labelAr : s.label}
              </option>
            ))}
          </Select>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setDeadOnly(false);
            }}
            className="h-9 !w-48 text-xs"
            aria-label={m.clients.filterStatus}
          >
            <option value="">{m.clients.filterStatus}: {m.common.all}</option>
            {STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {locale === "ar" ? s.labelAr : s.label}
              </option>
            ))}
          </Select>
          <button
            type="button"
            onClick={() => setStaleOnly((v) => !v)}
            className={cn(
              "h-9 rounded-md border px-3 text-xs font-medium transition-colors",
              staleOnly
                ? "border-warn bg-warn-soft text-warn"
                : "border-border text-muted hover:text-fg",
            )}
          >
            {m.clients.staleOnly}
          </button>
        </div>
      </Card>

      {/* --- Results -------------------------------------------------- */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={m.clients.noResults}
          action={
            <Link href={`/${locale}/clients/new`}>
              <Button size="sm" variant="primary">
                {m.nav.newClient}
              </Button>
            </Link>
          }
        />
      ) : view === "table" ? (
        <ClientTable rows={rows} locale={locale} />
      ) : (
        <KanbanBoard rows={rows} locale={locale} />
      )}

      <p className="tnum text-xs text-faint">
        {rows.length} {m.clients.count}
        {rows.length !== all.length ? ` ${m.common.of} ${all.length}` : ""}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Table view
 * ------------------------------------------------------------------ */

function ClientTable({ rows, locale }: { rows: ClientRow[]; locale: Locale }) {
  const { m } = useI18n();

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-border text-start text-[11px] tracking-wide text-muted uppercase">
            <th className="px-4 py-3 text-start font-medium">
              {m.clients.title}
            </th>
            <th className="px-3 py-3 text-start font-medium">{m.common.stage}</th>
            <th className="px-3 py-3 text-start font-medium">{m.common.status}</th>
            <th className="px-3 py-3 text-start font-medium">{m.common.owner}</th>
            <th className="px-3 py-3 text-start font-medium">
              {m.clients.lastContact}
            </th>
            <th className="px-3 py-3 text-start font-medium">
              {m.clients.nextAction}
            </th>
            <th className="px-4 py-3 text-end font-medium">{m.clients.value}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const dead = c.status === "dead";
            return (
              <tr
                key={c.id}
                className={cn(
                  "border-b border-border transition-colors last:border-0 hover:bg-surface-2",
                  dead && "bg-critical-soft/30",
                )}
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/${locale}/clients/${c.id}`}
                    className="group block min-w-0"
                  >
                    <span
                      className={cn(
                        "block truncate font-medium group-hover:text-accent",
                        dead && "text-critical line-through",
                      )}
                    >
                      {locale === "ar" && c.nameAr ? c.nameAr : c.name}
                    </span>
                    <span className="block truncate text-xs text-faint">
                      {[c.city, c.industry].filter(Boolean).join(" · ")}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-3">
                  <StageChip stage={c.stage} />
                </td>
                <td className="px-3 py-3">
                  <StatusChip status={c.status} compact />
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1">
                    <MemberBadge memberId={c.ownerId} size="sm" />
                    {c.collaboratorIds.map((id) => (
                      <MemberBadge key={id} memberId={id} size="xs" muted />
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <FreshnessChip days={c.daysSinceContact} stale={c.isStale} />
                  {c.lastInteraction ? (
                    <div className="mt-0.5 max-w-52 truncate text-xs text-faint">
                      {c.lastInteraction.summary}
                    </div>
                  ) : null}
                </td>
                <td className="max-w-56 px-3 py-3">
                  <span
                    className={cn(
                      "line-clamp-2 text-xs",
                      dead ? "text-faint" : "text-muted",
                    )}
                  >
                    {c.nextAction || "—"}
                  </span>
                </td>
                <td className="tnum px-4 py-3 text-end text-xs">
                  {c.dealValueSar ? (
                    <span className="font-medium">
                      {formatSar(c.dealValueSar)}
                      <span className="ms-1 text-faint">{m.common.sar}</span>
                    </span>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Kanban view
 * ------------------------------------------------------------------ */

function KanbanBoard({ rows, locale }: { rows: ClientRow[]; locale: Locale }) {
  const { m } = useI18n();

  const byStage = useMemo(() => {
    const map = new Map<Stage, ClientRow[]>();
    for (const s of STAGES) map.set(s.id, []);
    for (const c of rows) map.get(c.stage)?.push(c);
    return map;
  }, [rows]);

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-3">
        {STAGES.map((s) => {
          const items = byStage.get(s.id) ?? [];
          return (
            <div key={s.id} className="w-64 shrink-0">
              <div className="mb-2 flex items-center justify-between px-1">
                <span
                  className="text-xs font-semibold tracking-wide uppercase"
                  style={{ color: s.color }}
                >
                  {locale === "ar" ? s.labelAr : s.label}
                </span>
                <span className="tnum text-xs text-faint">{items.length}</span>
              </div>

              <div className="space-y-2">
                {items.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-faint">
                    {m.common.empty}
                  </div>
                ) : (
                  items.map((c) => (
                    <Link
                      key={c.id}
                      href={`/${locale}/clients/${c.id}`}
                      className={cn(
                        "block rounded-md border border-border bg-surface p-3 transition-colors hover:border-border-strong",
                        c.status === "dead" && "border-critical/40 bg-critical-soft/30",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-sm font-medium",
                            c.status === "dead" && "text-critical line-through",
                          )}
                        >
                          {locale === "ar" && c.nameAr ? c.nameAr : c.name}
                        </span>
                        <MemberBadge memberId={c.ownerId} size="xs" />
                      </div>
                      <div className="mt-1 truncate text-xs text-faint">
                        {c.city}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <FreshnessChip days={c.daysSinceContact} stale={c.isStale} />
                        {c.dealValueSar ? (
                          <span className="tnum text-xs text-muted">
                            {formatSar(c.dealValueSar)}
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
