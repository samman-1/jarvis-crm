"use client";

import { useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useSession } from "@/components/providers/session-provider";
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
import { PUBLIC_MEMBERS } from "@/lib/config/members";
import type { Client, ClientDetail, Contact } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";
import { toDateKey } from "@/lib/dates";

/**
 * Edit a client after it has been created.
 *
 * Previously a client was write-once: you could move its stage and log
 * against it, but a typo in the name or a new phone number meant living with
 * it. Everything that was on the create form is editable here.
 */
export function ClientEditor({
  client,
  locale,
  onSaved,
  onCancel,
}: {
  client: ClientDetail;
  locale: Locale;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { m } = useI18n();
  const { user } = useSession();

  const [form, setForm] = useState({
    name: client.name,
    nameAr: client.nameAr,
    city: client.city,
    address: client.address,
    industry: client.industry,
    website: client.website,
    ownerId: client.ownerId,
    whatHappened: client.whatHappened,
    whatWeOffered: client.whatWeOffered,
    objection: client.objection,
    teamWarning: client.teamWarning,
    nextAction: client.nextAction,
    nextActionAt: client.nextActionAt ? toDateKey(client.nextActionAt) : "",
    dealValueSar: client.dealValueSar?.toString() ?? "",
    notes: client.notes,
  });
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const patch: Partial<Client> = {
        name: form.name.trim(),
        nameAr: form.nameAr.trim(),
        company: form.name.trim(),
        city: form.city.trim(),
        address: form.address.trim(),
        industry: form.industry.trim(),
        website: form.website.trim(),
        ownerId: form.ownerId,
        whatHappened: form.whatHappened.trim(),
        whatWeOffered: form.whatWeOffered.trim(),
        objection: form.objection.trim(),
        teamWarning: form.teamWarning.trim(),
        nextAction: form.nextAction.trim(),
        nextActionAt: form.nextActionAt
          ? new Date(`${form.nextActionAt}T12:00:00`).toISOString()
          : null,
        dealValueSar: form.dealValueSar ? Number(form.dealValueSar) : null,
        notes: form.notes.trim(),
      };
      await db().updateClient(client.id, patch, user.id);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title={m.actions.editClient}
        action={
          <Button size="sm" variant="ghost" onClick={onCancel}>
            {m.common.cancel}
          </Button>
        }
      />

      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={m.newClient.name} required className="sm:col-span-2">
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="h-11"
            />
          </Field>
          <Field label={m.newClient.nameAr}>
            <Input
              value={form.nameAr}
              onChange={(e) => set("nameAr", e.target.value)}
              className="h-11"
              dir="rtl"
            />
          </Field>
          <Field label={m.newClient.city}>
            <Input
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              className="h-11"
            />
          </Field>
          <Field label={m.newClient.address}>
            <Input
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              className="h-11"
            />
          </Field>
          <Field label={m.newClient.industry}>
            <Input
              value={form.industry}
              onChange={(e) => set("industry", e.target.value)}
              className="h-11"
            />
          </Field>
          <Field label={m.newClient.website}>
            <Input
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
              className="h-11"
              dir="ltr"
            />
          </Field>
          <Field label={m.newClient.owner}>
            <Select
              value={form.ownerId}
              onChange={(e) => set("ownerId", e.target.value)}
              className="h-11"
            >
              {PUBLIC_MEMBERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {locale === "ar" ? p.nameAr : p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={m.newClient.quoted}>
            <Input
              type="number"
              inputMode="numeric"
              value={form.dealValueSar}
              onChange={(e) => set("dealValueSar", e.target.value)}
              className="h-11"
              dir="ltr"
            />
          </Field>
        </div>

        <Field label={m.client.whatHappened}>
          <Textarea
            value={form.whatHappened}
            onChange={(e) => set("whatHappened", e.target.value)}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={m.client.whatWeOffered}>
            <Input
              value={form.whatWeOffered}
              onChange={(e) => set("whatWeOffered", e.target.value)}
              className="h-11"
            />
          </Field>
          <Field label={m.client.objection}>
            <Input
              value={form.objection}
              onChange={(e) => set("objection", e.target.value)}
              className="h-11"
            />
          </Field>
          <Field label={m.clients.nextAction}>
            <Input
              value={form.nextAction}
              onChange={(e) => set("nextAction", e.target.value)}
              className="h-11"
            />
          </Field>
          <Field label={m.newClient.nextActionDate}>
            <Input
              type="date"
              value={form.nextActionAt}
              onChange={(e) => set("nextActionAt", e.target.value)}
              className="h-11"
              dir="ltr"
            />
          </Field>
        </div>

        <Field label={m.client.teamWarning} hint={m.newClient.teamWarning}>
          <Textarea
            value={form.teamWarning}
            onChange={(e) => set("teamWarning", e.target.value)}
            className="min-h-20"
          />
        </Field>

        <Field label={m.common.notes}>
          <Textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            className="min-h-20"
          />
        </Field>

        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={busy || !form.name.trim()}>
            {busy ? m.common.saving : m.actions.saveChanges}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {m.common.cancel}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Contacts
 * ------------------------------------------------------------------ */

export function ContactEditor({
  clientId,
  contacts,
  onChanged,
}: {
  clientId: string;
  contacts: Contact[];
  onChanged: () => void;
}) {
  const { m } = useI18n();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    title: "",
    phone: "",
    email: "",
  });

  function reset() {
    setDraft({ name: "", title: "", phone: "", email: "" });
    setAdding(false);
    setEditingId("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    setBusy(true);
    try {
      if (editingId) {
        await db().updateContact(editingId, {
          name: draft.name.trim(),
          title: draft.title.trim(),
          phone: draft.phone.trim(),
          whatsapp: draft.phone.trim(),
          email: draft.email.trim(),
        });
      } else {
        await db().addContact(clientId, {
          name: draft.name.trim(),
          title: draft.title.trim(),
          phone: draft.phone.trim(),
          whatsapp: draft.phone.trim(),
          email: draft.email.trim(),
          isPrimary: contacts.length === 0,
          notes: "",
          preferredChannel: "",
        });
      }
      reset();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(m.actions.removeConfirm)) return;
    await db().deleteContact(id);
    onChanged();
  }

  async function makePrimary(id: string) {
    await db().updateContact(id, { isPrimary: true });
    onChanged();
  }

  function startEdit(c: Contact) {
    setDraft({
      name: c.name,
      title: c.title,
      phone: c.phone || c.whatsapp,
      email: c.email,
    });
    setEditingId(c.id);
    setAdding(true);
  }

  return (
    <div className="space-y-3">
      {contacts.map((c) => (
        <div
          key={c.id}
          className="rounded-md border border-border bg-surface-2 p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{c.name}</div>
              <div className="truncate text-xs text-faint">{c.title}</div>
            </div>
            {c.isPrimary ? (
              <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent">
                {m.client.primary}
              </span>
            ) : null}
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {c.phone ? (
              <a
                href={`tel:${c.phone.replace(/\s/g, "")}`}
                className="inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
                dir="ltr"
              >
                📞 {c.phone}
              </a>
            ) : null}
            {c.whatsapp || c.phone ? (
              <a
                href={`https://wa.me/${(c.whatsapp || c.phone).replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-1.5 text-xs text-muted transition-colors hover:border-success hover:text-success"
              >
                💬 WhatsApp
              </a>
            ) : null}
            {c.email ? (
              <a
                href={`mailto:${c.email}`}
                className="inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-1.5 text-xs text-muted transition-colors hover:border-info hover:text-info"
                dir="ltr"
              >
                ✉️ {c.email}
              </a>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
            <button
              type="button"
              onClick={() => startEdit(c)}
              className="text-faint transition-colors hover:text-fg"
            >
              {m.common.edit}
            </button>
            {!c.isPrimary ? (
              <button
                type="button"
                onClick={() => makePrimary(c.id)}
                className="text-faint transition-colors hover:text-accent"
              >
                {m.actions.makePrimary}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => remove(c.id)}
              className="text-faint transition-colors hover:text-critical"
            >
              {m.actions.remove}
            </button>
          </div>
        </div>
      ))}

      {adding ? (
        <form
          onSubmit={submit}
          className="animate-enter space-y-2 rounded-md border border-accent/40 bg-accent-softer p-3"
        >
          <Input
            autoFocus
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder={m.actions.contactName}
            className="h-11"
          />
          <Input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder={m.actions.contactTitle}
            className="h-11"
          />
          <Input
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            placeholder={m.actions.contactPhone}
            className="h-11"
            inputMode="tel"
            dir="ltr"
          />
          <Input
            type="email"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            placeholder={m.actions.contactEmail}
            className="h-11"
            dir="ltr"
          />
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              variant="primary"
              className="flex-1"
              disabled={busy || !draft.name.trim()}
            >
              {busy ? m.common.saving : m.common.save}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={reset}>
              {m.common.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          className="w-full"
          onClick={() => setAdding(true)}
        >
          + {m.actions.addContact}
        </Button>
      )}
    </div>
  );
}
