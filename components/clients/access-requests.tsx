"use client";

import { useI18n } from "@/components/providers/i18n-provider";
import { useSession } from "@/components/providers/session-provider";
import { useAsync, useMounted } from "@/lib/hooks/use-async";
import { db } from "@/lib/data";
import { Button, Card, CardHeader } from "@/components/ui/primitives";
import { memberLabel } from "@/lib/config/members";
import type { AccessRequest, ClientRow } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";

/**
 * Someone wants onto one of your clients.
 *
 * Only shown when there is something to answer, because a card that says
 * "no requests" every day is a card people stop seeing. Approving adds them
 * as a collaborator; declining leaves the client exactly as it was.
 */
export function AccessRequests({
  clients,
  locale,
}: {
  clients: ClientRow[];
  locale: Locale;
}) {
  const { m } = useI18n();
  const { user } = useSession();
  const mounted = useMounted();

  const requests = useAsync(
    () =>
      mounted
        ? db().listAccessRequests(user.id)
        : Promise.resolve({
            incoming: [] as AccessRequest[],
            outgoing: [] as AccessRequest[],
          }),
    [mounted, user.id],
  );

  const incoming = requests.data?.incoming ?? [];
  if (!mounted || incoming.length === 0) return null;

  const nameOf = (id: string) => {
    const c = clients.find((x) => x.id === id);
    if (!c) return "";
    return locale === "ar" && c.nameAr ? c.nameAr : c.name;
  };

  async function decide(id: string, approve: boolean) {
    await db().decideAccess(id, user.id, approve);
    requests.reload();
  }

  return (
    <Card className="border-warn">
      <CardHeader title={m.access.title} hint={m.access.hint} />
      <ul className="space-y-2.5">
        {incoming.map((r) => (
          <li
            key={r.id}
            className="rounded-md border border-border bg-surface-2 p-3"
          >
            <p className="text-sm leading-relaxed">
              <strong>{memberLabel(r.requesterId)}</strong>{" "}
              {m.access.wantsToJoin}{" "}
              <strong>{nameOf(r.clientId) || m.access.aClient}</strong>.
            </p>
            {r.reason ? (
              <p className="mt-1 text-xs text-muted">{r.reason}</p>
            ) : null}
            <div className="mt-2.5 flex gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => void decide(r.id, true)}
              >
                {m.access.approve}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void decide(r.id, false)}
              >
                {m.access.decline}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
