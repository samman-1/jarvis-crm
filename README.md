# Jarvis CRM

Internal client and team tracking system for Jarvis AI Agency — three people, one shared picture of every company we have walked into.

It answers four questions:

1. **Who has been to this client?** Every company any of us has contacted, with stage, status, contact card and full history.
2. **Should I go there at all?** Typing a company name into the new-client form checks it against everyone's clients before you waste a morning. Companies marked **dead** produce a hard block with the reason and who closed it.
3. **What has everyone else been doing?** Any member can see any other member's week, month or last three months — clients, activity, tasks, attendance, efficiency.
4. **Who is working when?** Each person types the time they started and finished on Sunday through Thursday — filled in from a phone, whenever suits, not clocked live. Short days ask for a reason. The Tuesday review then decides Wednesday and Thursday per person.

---

## Status: Phase A — no database yet

This build runs on a **local mock data layer**. Everything you add is stored in your own browser (`localStorage`) and is **not shared with the other members**. It exists so we can agree the interface and the workflow before wiring anything up.

**Phase B** connects Supabase (on Ehan's account) and the three of you share one live dataset. The switch is a single file — see *Architecture* below.

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

Temporary passwords, changeable in `lib/config/members.ts` or via environment variables:

| Slot | Member  | Role | Password  |
|------|---------|------|-----------|
| 1    | Ehano   | CEO  | `jarvis1` |
| 2    | Sammoni | CTO  | `jarvis2` |
| 3    | Aboodi  | CMO  | `jarvis3` |

Change one properly:

```bash
node scripts/hash-password.mjs "a better password"
# paste the result into that member's passwordHash
```

Or set `JARVIS_PASSWORD_1/2/3` in Vercel — those win over the committed hash and need no code change.

---

## Architecture

```
app/[locale]/login            three-tile sign-in
app/[locale]/(app)/…          the authenticated app
proxy.ts                      locale routing + session guard
lib/data/provider.ts          ← the interface everything reads through
lib/data/mock-provider.ts       Phase A: seeded demo data + localStorage
lib/data/supabase-provider.ts   Phase B: to be added
lib/config/members.ts         the three of us — names, colours, passwords
lib/config/stages.ts          pipeline stages + client statuses
lib/config/schedule.ts        work week, 09:00–14:00, Asia/Riyadh
lib/efficiency.ts             the 0–100 score and its four components
```

**No page or component imports a provider directly** — they all go through `@/lib/data`. That is what makes Phase B a one-file job instead of a rewrite.

The three config files are deliberately the only places people, stage names and work rules are written. Renaming a stage or moving a field day is a one-file edit.

### Stage vs status

Stage is *where they are in the pipeline*. Status is *whether anyone should touch them at all*. They are separate because a client can sit at "Proposal" and still be permanently dead.

| Status | Effect on the other two members |
|---|---|
| Active / On hold / Client | Warning: "already owned by X", with a one-tap *add me as collaborator* |
| Lost — can retry | Quiet note; retrying is legitimate |
| **Dead — do not approach** | **Hard red block.** Requires a written reason, names who closed it, and blocks the form until explicitly overridden |

### Efficiency score

One number per member per week, always shown with its breakdown:

| Component | Weight | Basis |
|---|---|---|
| Attendance | 30 | minutes covered inside 09:00–14:00 across the field days |
| Field activity | 30 | client contact logged on field days, target 4/day |
| Pipeline movement | 25 | stage advances + proposals sent |
| Follow-through | 15 | tasks completed on time |

Weights live in `lib/efficiency.ts`. It feeds the Tuesday Wed/Thu recommendation — which is advice; a human still flips the switch.

---

## Getting real data in

`docs/CLIENT-INTAKE.md` is the questionnaire to send Ehano and Aboodi, with `docs/clients-template.csv` for anyone who prefers a spreadsheet. Their answers replace `lib/data/seed.ts`.

---

## Phase B checklist

1. Create the Supabase project on Ehan's account.
2. Run `supabase/migrations/*.sql` (schema, RLS, views, triggers).
3. Seed the three members into `auth.users` and `members`.
4. Write `lib/data/supabase-provider.ts` against `DataProvider`.
5. Set `NEXT_PUBLIC_DATA_MODE=supabase` plus the URL and anon key.
6. Point the login route at `signInWithPassword` using each slot's email.

Everything above that line stays exactly as it is.

---

Design language, colours and typography are taken from the Jarvis client-facing portal so this sits visually beside the products we sell.
