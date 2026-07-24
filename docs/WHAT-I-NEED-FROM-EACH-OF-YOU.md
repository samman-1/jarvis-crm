# What I need from each of you

Sammoni asked what is needed from the CEO, the CTO and the CMO to finish this properly. This is the whole list, split by person, in the order it is needed.

Everything marked **blocking** stops work until it arrives. Everything else can come later without holding anything up.

---

## From everyone — all three of you

These three things are the same for each person, and they are the only ones that are genuinely blocking.

1. **Your filled-in client list.** `docs/CLIENT-INTAKE.md` — every company you have contacted or visited, even the ones that went nowhere. Especially the ones that went nowhere. **Blocking** — until this arrives the system runs on invented demo companies.
2. **Your password.** Say the one you want, or keep the temporary one you have now.
3. **Your real working hours.** Is 09:00–14:00 right for you, or are your hours different? And are Sunday, Monday and Tuesday actually your field days?

Then, once you have opened it on your phone: **tell me the first thing that annoyed you.** That is worth more than a feature request.

---

## From Ehano — CEO

You are the one who decides how the team is measured, so the judgement calls are yours.

**Blocking**

1. **The Supabase account.** When we move off demo data, the database goes on your account, not Sammoni's. I need you to create the Supabase project and hand over the URL and keys. Two minutes of work, but nothing shared happens until it exists.

**Decisions only you should make**

2. **Do you want powers the other two don't have?** Reopening a client someone marked dead, reassigning who owns a client, deleting records, correcting someone's hours. Right now all three of you are equal and nobody can edit anyone else's hours. Say if that should change.
3. **Are the efficiency weights right?** The score is currently: attendance 30%, field activity 30%, pipeline movement 25%, follow-through on tasks 15%. If in your view showing up matters more than closing, or the reverse, tell me the numbers you want.
4. **What counts as a good week?** Right now the target is 4 client contacts per field day, and 2 deals moved forward per week. Both are guesses. Give me your real numbers.
5. **The Wednesday/Thursday rule.** The system recommends off above 75%, working below that. Is that the line you would actually draw?

**Useful, not urgent**

6. Any client you have that the other two have never heard about — those are the highest-value entries in the whole database.
7. Whether the CEO should get a weekly summary of all three members, and whether that should be a page or a message.

---

## From Sammoni — CTO

You are the one shipping it, so most of this is operational.

**Blocking**

1. **What EMA stands for.** You chose it as the name but the spelling did not come through. One line and the whole system renames itself.
2. **Authorise the Vercel GitHub app** so pushing to GitHub deploys automatically. One click, link is in the chat.

**Decisions**

3. **Should the URL stay guessable?** It is currently `jarvis-crm-woad.vercel.app`. Until the database is connected there is no per-user security beyond the password gate, so an obscure URL is part of the protection. Say if you want it changed, or pointed at a subdomain of `jarvisksa.com` like the Mecca portal is.
4. **Your own client list** — same intake form as the others. You have not sent yours either.
5. **When do we move to Supabase?** Say the word and I do it; it is roughly a day of work and it is the point where the three of you finally see each other's data.

**Useful, not urgent**

6. Do you want this on a phone home screen as an app icon? It is a small amount of work to make it installable, and it would make it feel like a real app rather than a website.
7. Should the pipeline stages stay as they are — Lead, Contacted, Meeting, Proposal, Negotiation, Won, Lost — or does the way you actually sell need different ones?

---

## From Aboodi — CMO

You are out in the field the most, so the parts that decide whether this gets used or abandoned are yours.

**Blocking**

1. **Your client list**, same form. You have the most cold walk-ins, which means you have the most companies the other two know nothing about — and the most dead ones that would waste their morning.

**The important ones**

2. **Every company you would not go back to, and why.** Be blunt. "The owner shouted at us in front of customers" is exactly the sentence that saves Ehano a wasted trip. This is the single highest-value thing anyone can give me.
3. **How do you actually record things now?** Phone notes, WhatsApp messages to yourself, memory, nothing at all? If entering a visit here is slower than what you do today, you will stop using it, and I would rather redesign it than watch that happen.
4. **How long can you spend logging a visit?** 10 seconds, 30 seconds, a minute? That number decides how many fields the form is allowed to have.

**Useful, not urgent**

5. Do you want to log a visit while standing outside the client, or all at once in the evening? If it is the evening, the form should let you set the time yourself rather than assume now.
6. Anything about a client that is sensitive — a family connection, a competitor already inside, someone we should not mention by name. There is a field for exactly this and it is currently empty for every client.
7. Which parts of the interface you want in Arabic. The whole thing is translated, but you are the one most likely to use it that way.

---

## The order this should happen in

1. All three send the intake forms. → the demo companies get replaced with yours.
2. Sammoni says what EMA stands for. → renamed.
3. Ehano creates the Supabase project. → the three of you start seeing each other's data.
4. Ehano confirms the score weights and targets. → the efficiency number becomes meaningful instead of a placeholder.
5. Everyone uses it for one real week. → then we fix whatever turns out to be wrong, which is always something.
