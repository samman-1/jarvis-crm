# Jarvis CRM — Information Request

**To:** Ehano (CEO), Sammoni (CTO), Aboodi (CMO)
**From:** Sammoni
**Why:** We're building our own internal system so that all three of us can see every client we've been to, what stage they're at, who's handling them, and — most importantly — **which companies nobody should walk into again**. Right now that information lives in three separate heads and three separate phones.

Please fill this in as honestly and bluntly as you can. Rough answers are fine. **"I don't remember" is a valid answer** — don't let a missing detail stop you from sending the rest.

You can reply however is easiest: this document with answers typed under each question, a WhatsApp voice note, or the spreadsheet (`clients-template.csv`) if you prefer filling columns.

---

## PART 1 — About you

Answer once.

1. **Your full name** as you want it displayed in the system, and your role.
2. **Your working hours on field days.** Is 9:00 AM – 2:00 PM correct for you, or are your hours different?
3. **Which days do you actually go out to clients?** (We assumed Sunday, Monday, Tuesday. Correct us if yours differ.)
4. **Password you want for your login** — or reply "temporary" and I'll assign you one you can change later.
5. **Language:** do you want the interface in English, Arabic, or both?
6. **Your phone number and email** as they should appear to the other two.

---

## PART 2 — Your clients

**Repeat this block for every single company you have contacted or visited — even once, even badly, even ones that went nowhere.** The ones that went nowhere are the most important ones for the other two members to know about.

If you have twenty, send twenty. If you only remember the company name and nothing else, send just the name — that alone stops someone else walking in blind.

### Identity

1. **Company name** — exactly as you'd say it. Add the Arabic name too if that's how it's known.
2. **City / district.**
3. **What do they do?** (Industry — restaurant, clinic, logistics, retail, contracting, etc.)
4. **Website, Instagram, or any online presence?** (If none, say none — that's useful information.)
5. **Roughly how big are they?** (A guess is fine — small shop, mid-size company, large group.)

### How we got to them

6. **How did we find them?** Cold walk-in, referral, inbound message, event, personal contact — and if it was a referral or a contact, **whose**?
7. **Date of first contact** and **date of the most recent contact.** Approximate is fine — "early June", "about three weeks ago".
8. **Has anyone else from our team dealt with them, as far as you know?** Even a phone call from someone else counts.

### The contact person

9. **Name of the person you actually deal with**, and their job title.
10. **Their phone / WhatsApp number.**
11. **Their email.**
12. **Is there a second person worth recording?** The gatekeeper who decides whether you get in, the owner who actually signs, the technical person who evaluates us. Name + role + number.
13. **How do they prefer to be contacted?** (WhatsApp / call / email / walk in.)

### Where it stands right now

14. **Which stage are they at?** Pick one:

    | Stage | Means |
    |---|---|
    | **Lead** | We know they exist. Nobody has contacted them yet. |
    | **Contacted** | First message, call, or walk-in happened. No real conversation yet. |
    | **Meeting** | A proper meeting or visit took place. They know who we are and what we do. |
    | **Proposal** | We sent them an offer / quote. |
    | **Negotiation** | They're interested. We're discussing price, scope, or timing. |
    | **Won** | Signed. They're a client. |
    | **Lost** | It didn't happen. |

15. **Which status?** This is separate from stage and it matters a lot:

    | Status | Means | Use it when |
    |---|---|---|
    | **Active** | In play, you're working on it | Normal ongoing deal |
    | **On hold** | Paused, but worth going back to | "Call me after Ramadan", waiting for their budget cycle — **tell us until when** |
    | **Won** | Signed and done | They're a paying client |
    | **Lost — can retry** | Said no this time, but the door is still open | Wrong timing, no budget this quarter — **tell us why, and when we could try again** |
    | **☠ Dead — do not approach** | Finished forever. Nobody goes back. | Hostile owner, threw us out, wrong fit permanently, told us never to return, they're a competitor's, bad blood — **you must tell us why** |

    > **The "Dead" status is the whole reason we're building this.** If you mark a company as dead, the system will physically block the other two from adding or approaching them and will show them your reason. Be blunt. "The owner was rude and told us not to come back" is exactly the kind of sentence that saves someone a wasted morning.

16. **What actually happened — in your own words.** Two or three sentences. What you offered, how they reacted, what was agreed or refused. Write it like you'd tell it to a friend, not like a report.

17. **What exactly did we offer them?** Which AI service or solution — and did you quote a price? If yes, **how much in SAR?**

18. **What's their objection or hesitation, if any?** (Price, don't understand AI, "we'll think about it", already have someone, no decision-maker available.)

### Next step

19. **What is the next action, and by when?** Examples: "Call Ahmed after Eid", "Send proposal Sunday", "Drop by again in two weeks", "Nothing — dead."
20. **⚠ Anything the other two must know before they ever mention this company to anyone?** Sensitivities, a competitor already inside, a family connection, a bad history, someone we shouldn't mention by name.

---

## PART 3 — The history (optional, but this is what makes it powerful)

For each client, if you can remember, list every separate contact as its own line:

```
Date          Type                                          What happened
12 June       Visit                                         Walked in, met the receptionist, left a card
19 June       WhatsApp                                      Sent our profile, no reply
26 June       Call                                          Spoke to the manager, booked a meeting
3 July        Meeting                                       Presented the automation idea, they liked it
7 July        Proposal sent                                 Sent quote, 18,000 SAR
```

Type is one of: **Visit · Call · WhatsApp · Email · Meeting · Proposal sent · Follow-up**

This is what builds the timeline and makes the activity and efficiency numbers real instead of decorative. **If you can't remember the middle steps, just give me the first and the last contact** — I'll work with that.

---

## PART 4 — What do you actually want from this thing?

Answer honestly, this shapes what gets built.

1. **You open this on a Sunday morning before heading out. What are the first three things you want to see on the screen?**
2. **What do you most want to know about the other two members' week?** (Who they saw? How many? Whether they're on schedule? What's stuck?)
3. **What are you tracking right now in your phone notes, WhatsApp saved messages, or your head** that should live in here instead?
4. **What would make you stop using this after two weeks?** (Be honest — too much typing, too slow, too complicated. Better to know now.)
5. **Anything you want that isn't mentioned anywhere in this document?**

---

## PART 5 — Setup decisions (Sammoni only)

1. GitHub repository name under `samman-1`, and public or private.
2. Should the Vercel URL be easy to guess (`jarvis-crm.vercel.app`) or something obscure? While there's no database, the URL itself is part of the security.
3. Should the CEO have powers the other two don't — reopening dead clients, reassigning who owns a client, deleting records — or are all three fully equal?
4. Final name for the system: **Jarvis Control** / **Jarvis HQ** / **Jarvis Field** / **Jarvis One** / just "Jarvis CRM".

---

## A note on the money fields

There are fields for deal value and cost per client. **Leave them empty for now** — we know there's no real revenue yet. They exist so that the day there is, nothing needs rebuilding. If you quoted a price to someone, put the quoted number in; that's useful even if it never closed.

---

*Send whatever you have. An incomplete answer today is worth more than a perfect one next month.*
