# Jarvis CRM

Internal client and team tracking system for Jarvis AI Agency. Three people, one shared picture of every company we have walked into.

Live at **[crm.jarvisksa.com](https://crm.jarvisksa.com)**.

It answers four questions:

1. **Who has been to this client?** Every company any of us has contacted, with stage, status, contact card and full history.
2. **Should I go there at all?** Typing a company name into the new-client form checks it against everyone's clients before you waste a morning. Companies marked **dead** produce a hard block with the reason and who closed it.
3. **What has everyone else been doing?** Any member can see any other member's week, month or last three months: clients, activity, tasks, routes.
4. **Where am I going on Sunday?** Routes are planned the day before and hand off to Google Maps in one tap.

---

## Status: live and shared

Everything is stored in one Supabase database, so all three of us see the same
clients, the same history and the same messages the moment they are written.

Two things are switched off on purpose and show a "coming soon" panel: the
0–100 efficiency score, and the weekly timesheet that fed it. The score was a
guess, and measuring people against a guess is worse than not measuring them.
Every visit still carries the time it happened, so the day reconstructs itself
from real work. Flip `EFFICIENCY_ENABLED` / `HOURS_ENABLED` in
`lib/efficiency.ts` to bring them back.

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

### Passwords

**This repository is public. No password is stored in it.**

Each member sets their own in **Settings → Password**. That writes a scrypt
hash to the database which nobody, including whoever runs the deployment, can
read back, and from then on it is the only password that works for them.

Anyone who has not set one yet falls back to an environment variable:

| Variable | Member |
|---|---|
| `JARVIS_PASSWORD_1` | Ehano |
| `JARVIS_PASSWORD_2` | Sammoni |
| `JARVIS_PASSWORD_3` | Aboodi |

Set them in Vercel for production, and in `.env.local` (git-ignored) to run
locally; copy `.env.example` to start. If neither a stored hash nor a variable
exists, that member cannot sign in. The app fails closed rather than falling
back to a default.

All three accounts are identical. There are no roles and no admin: everyone
sees everything.

---

## Architecture

```
app/[locale]/login            three-tile sign-in
app/[locale]/(app)/…          the authenticated app
proxy.ts                      locale routing + session guard
lib/data/provider.ts          ← the interface everything reads through
lib/data/supabase-provider.ts   the browser side: calls /api/db, holds no key
lib/data/supabase-server.ts     the server side: service_role, never bundled
lib/data/mock-provider.ts       offline fallback, kept for local work
app/api/db/route.ts           the whitelisted door into the database
app/api/auth/password/route.ts change your own password
lib/config/members.ts         the three of us: names, colours, env var names
lib/config/stages.ts          pipeline stages + client statuses
lib/config/schedule.ts        work week, 09:00 to 14:00, Asia/Riyadh
lib/efficiency.ts             the score, and the two switches turning it off
```

**No page or component imports a provider directly.** They all go through
`@/lib/data`, which is why swapping the storage behind them was a one-file job.

The browser never holds a database key. Every read and write goes to
`/api/db`, which checks the session cookie and refuses any operation not on
its whitelist. Row level security is enabled on every table with no policies
at all, so even the public anon key can do nothing; only the server's
service_role key works.

The three config files are deliberately the only places people, stage names and work rules are written. Renaming a stage or moving a field day is a one-file edit.

### Stage vs status

Stage is *where they are in the pipeline*. Status is *whether anyone should touch them at all*. They are separate because a client can sit at "Proposal" and still be permanently dead.

| Status | Effect on the other two members |
|---|---|
| Active / On hold / Client | Warning: "already owned by X", with a one-tap *add me as collaborator* |
| Lost, can retry | Quiet note; retrying is legitimate |
| **Dead, do not approach** | **Hard red block.** Requires a written reason, names who closed it, and blocks the form until explicitly overridden |

### Efficiency score

One number per member per week, always shown with its breakdown:

| Component | Weight | Basis |
|---|---|---|
| Attendance | 30 | minutes covered inside 09:00–14:00 across the field days |
| Field activity | 30 | client contact logged on field days, target 4/day |
| Pipeline movement | 25 | stage advances + proposals sent |
| Follow-through | 15 | tasks completed on time |

Weights live in `lib/efficiency.ts`. It feeds the Tuesday Wed/Thu recommendation, which is advice. A human still flips the switch.

---

## Getting real data in

`docs/WHAT-WE-NEED.md` is the short list to send round: company name, what
happened, and whether it is finished for good.

Nobody has to fill in a form per client. **Clients → Add many** takes the
message you would have sent to the group chat, one company per line, reads it,
and shows you what it understood before anything is saved. The same screen has
a *What I did* mode: write a day name on its own line and everything under it
lands on that day, with the time if you wrote one.

---

## Deploying

```bash
git push                 # GitHub: samman-1/jarvis-crm
npx vercel --prod        # Vercel: mohammads-projects-903de553
```

The live site keeps serving the previous build until the new one finishes
compiling, so a broken build cannot take the site down. Client data lives in
Supabase and is untouched by deployments. A bad release rolls back from the
Vercel dashboard in one click.

Database changes are the exception: `supabase/migrations/*.sql` has to be run
by hand in the Supabase SQL editor, in order.

---

Design language, colours and typography are taken from the Jarvis client-facing portal so this sits visually beside the products we sell.
