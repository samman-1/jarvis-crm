"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSession } from "@/components/providers/session-provider";
import { useAsync, useDebounced, useMounted } from "@/lib/hooks/use-async";
import { db } from "@/lib/data";
import {
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { PageHeader } from "@/components/shell/page-header";
import { DuplicateWarning } from "@/components/clients/duplicate-warning";
import { STAGES, STATUSES, type ClientStatus, type Stage } from "@/lib/config/stages";
import { PUBLIC_MEMBERS } from "@/lib/config/members";
import type { Locale } from "@/lib/i18n/config";

const SOURCES = [
  "Cold walk-in",
  "Referral",
  "Inbound — website",
  "Inbound — Instagram",
  "Cold call",
  "Event",
  "Personal contact",
];

export function NewClientForm({ locale }: { locale: Locale }) {
  const { m } = useI18n();
  const { user } = useSession();
  const router = useRouter();
  const mounted = useMounted();

  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [city, setCity] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");

  const [contactName, setContactName] = useState("");
  const [contactTitle, setContactTitle] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const [source, setSource] = useState(SOURCES[0]);
  const [referredBy, setReferredBy] = useState("");
  const [stage, setStage] = useState<Stage>("lead");
  const [status, setStatus] = useState<ClientStatus>("active");
  const [ownerId, setOwnerId] = useState(user.id);

  const [whatHappened, setWhatHappened] = useState("");
  const [whatWeOffered, setWhatWeOffered] = useState("");
  const [quoted, setQuoted] = useState("");
  const [objection, setObjection] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextActionAt, setNextActionAt] = useState("");
  const [teamWarning, setTeamWarning] = useState("");
  const [deadReason, setDeadReason] = useState("");

  const [dismissedWarning, setDismissedWarning] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  /* --- The collision check ---------------------------------------- */
  const debouncedName = useDebounced(name, 320);
  const debouncedPhone = useDebounced(contactPhone, 320);

  const { data: matches } = useAsync(
    () =>
      mounted && (debouncedName.trim().length >= 3 || debouncedPhone.length >= 7)
        ? db().findPotentialDuplicates({
            name: debouncedName,
            phone: debouncedPhone,
          })
        : Promise.resolve([]),
    [mounted, debouncedName, debouncedPhone],
  );

  const found = matches ?? [];
  const blocked = found.some((f) => f.level === "block") && !dismissedWarning;

  async function addMeToExisting(clientId: string) {
    await db().addCollaborator(clientId, user.id);
    router.push(`/${locale}/clients/${clientId}`);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(m.newClient.nameRequired);
      return;
    }
    if (status === "dead" && !deadReason.trim()) {
      setError(m.client.deadReasonRequired);
      return;
    }

    setBusy(true);
    setError("");
    try {
      const created = await db().createClient(
        {
          name: name.trim(),
          nameAr: nameAr.trim(),
          city: city.trim(),
          industry: industry.trim(),
          website: website.trim(),
          stage,
          status,
          ownerId,
          broughtById: user.id,
          source,
          referredBy: referredBy.trim(),
          dealValueSar: quoted ? Number(quoted) : null,
          whatHappened: whatHappened.trim(),
          whatWeOffered: whatWeOffered.trim(),
          objection: objection.trim(),
          teamWarning: teamWarning.trim(),
          nextAction: nextAction.trim(),
          nextActionAt: nextActionAt ? new Date(nextActionAt).toISOString() : null,
          closedReason: deadReason.trim(),
          contact: contactName.trim()
            ? {
                name: contactName.trim(),
                title: contactTitle.trim(),
                phone: contactPhone.trim(),
                whatsapp: contactPhone.trim(),
                email: contactEmail.trim(),
              }
            : undefined,
        },
        user.id,
      );
      router.push(`/${locale}/clients/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-5">
      <PageHeader title={m.newClient.title} subtitle={m.newClient.subtitle} />

      {/* The warning sits directly under the name field, where it is
          impossible to miss while typing. */}
      <DuplicateWarning
        matches={found}
        locale={locale}
        onAddMe={addMeToExisting}
        onDismiss={() => setDismissedWarning(true)}
        dismissed={dismissedWarning}
      />

      <Card>
        <CardHeader title={m.newClient.name} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={m.newClient.name} required className="sm:col-span-2">
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setDismissedWarning(false);
              }}
              placeholder={m.newClient.namePlaceholder}
              autoFocus
            />
          </Field>
          <Field label={m.newClient.nameAr} hint={m.common.optional}>
            <Input
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              dir="rtl"
            />
          </Field>
          <Field label={m.newClient.city}>
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <Field label={m.newClient.industry}>
            <Input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            />
          </Field>
          <Field label={m.newClient.website} hint={m.common.optional}>
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title={m.newClient.contactName} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={m.newClient.contactName}>
            <Input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </Field>
          <Field label={m.newClient.contactTitle}>
            <Input
              value={contactTitle}
              onChange={(e) => setContactTitle(e.target.value)}
            />
          </Field>
          <Field
            label={m.newClient.contactPhone}
            hint={m.duplicate.matchedPhone}
          >
            <Input
              value={contactPhone}
              onChange={(e) => {
                setContactPhone(e.target.value);
                setDismissedWarning(false);
              }}
              inputMode="tel"
              dir="ltr"
            />
          </Field>
          <Field label={m.newClient.contactEmail}>
            <Input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              dir="ltr"
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title={m.common.status} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={m.newClient.stage}>
            <Select
              value={stage}
              onChange={(e) => setStage(e.target.value as Stage)}
            >
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {locale === "ar" ? s.labelAr : s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={m.newClient.status}>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as ClientStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {locale === "ar" ? s.labelAr : s.label}
                </option>
              ))}
            </Select>
          </Field>

          {status === "dead" ? (
            <Field
              label={m.client.deadReasonLabel}
              hint={m.client.deadReasonHint}
              required
              className="sm:col-span-2"
            >
              <Textarea
                value={deadReason}
                onChange={(e) => setDeadReason(e.target.value)}
                className="min-h-20 border-critical"
              />
            </Field>
          ) : null}

          <Field label={m.newClient.owner}>
            <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              {PUBLIC_MEMBERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {locale === "ar" ? p.nameAr : p.name}
                  {p.id === user.id ? ` (${m.common.you})` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={m.newClient.source}>
            <Select value={source} onChange={(e) => setSource(e.target.value)}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          {source === "Referral" || source === "Personal contact" ? (
            <Field label={m.newClient.referredBy} className="sm:col-span-2">
              <Input
                value={referredBy}
                onChange={(e) => setReferredBy(e.target.value)}
              />
            </Field>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader title={m.newClient.whatHappened} />
        <div className="grid gap-4">
          <Field label={m.newClient.whatHappened}>
            <Textarea
              value={whatHappened}
              onChange={(e) => setWhatHappened(e.target.value)}
              placeholder={m.client.logPlaceholder}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={m.newClient.whatWeOffered}>
              <Input
                value={whatWeOffered}
                onChange={(e) => setWhatWeOffered(e.target.value)}
              />
            </Field>
            <Field label={m.newClient.quoted} hint={m.client.moneyEmpty}>
              <Input
                type="number"
                inputMode="numeric"
                value={quoted}
                onChange={(e) => setQuoted(e.target.value)}
                dir="ltr"
              />
            </Field>
            <Field label={m.newClient.objection}>
              <Input
                value={objection}
                onChange={(e) => setObjection(e.target.value)}
              />
            </Field>
            <Field label={m.newClient.nextAction}>
              <Input
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
              />
            </Field>
            <Field label={m.newClient.nextActionDate}>
              <Input
                type="date"
                value={nextActionAt}
                onChange={(e) => setNextActionAt(e.target.value)}
                dir="ltr"
              />
            </Field>
          </div>
          <Field
            label={m.newClient.teamWarning}
            hint={m.client.teamWarning}
          >
            <Textarea
              value={teamWarning}
              onChange={(e) => setTeamWarning(e.target.value)}
              className="min-h-20"
            />
          </Field>
        </div>
      </Card>

      {error ? (
        <p className="rounded-md bg-critical-soft px-4 py-3 text-sm text-critical" role="alert">
          {error}
        </p>
      ) : null}

      {blocked ? (
        <p className="rounded-md bg-critical-soft px-4 py-3 text-sm font-medium text-critical">
          {m.duplicate.deadWasted}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={busy || blocked}>
          {busy ? m.newClient.submitting : m.newClient.submit}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push(`/${locale}/clients`)}
        >
          {m.common.cancel}
        </Button>
      </div>
    </form>
  );
}
