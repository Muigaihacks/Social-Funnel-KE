# Make.com Build Guide → Our Implementation Map

This doc maps the **Make.com Build Guide** (full text in `AcquisitionOS_ Build Guide Make . com.txt`) to our stack: **n8n** (scenarios) + **custom backend** (Prisma/PostgreSQL) + same third-party accounts.

---

## What I understood from the .txt (no screenshots needed)

The plain-text export is **fully usable**. Structure is preserved:

- **Part 0:** Why Make.com (ops pricing, visual builder) vs Zapier vs n8n; why Airtable vs HubSpot/Sheets; why GPT-4o-mini; self-eat-your-own-cooking.
- **Part 1:** Seven layers (Capture, CRM, Comms, AI, Booking, Notifications, Reporting); Master Lead Flow diagram (text); **Full Scenario Map** table (S1–S12).
- **Part 2:** Every account and API (Make, Airtable, OpenAI, 360dialog, Facebook BM, Calendly, SendGrid, Slack, LinkedIn); API reference table.
- **Part 3:** Airtable data model (Contacts, Message Log, Follow-Up Queue, etc.) — we’ve mirrored this in **Prisma** (Lead, MessageLog, FollowUpQueue, ActivityLog, StageTransition).
- **Part 4:** Each scenario S1–S12 with module-by-module build — we implement the **same logic** in n8n + backend.
- **Part 5:** Credit optimisation (Make.com ops) — we don’t pay per op; we optimise for clarity and correctness.
- **Part 6:** Vertical playbook, pipeline stages, audit call flow — we use the same stages and flow.

**Conclusion:** No screenshots needed. The .txt is enough to drive our checklist, scenario map, and implementation.

---

## Scenario map: Make.com (S1–S12) → Our build

| # | Make scenario | Trigger | Our equivalent |
|---|----------------|---------|-----------------|
| **S1** | Lead Capture Router | Webhook (all sources) | n8n webhooks (Meta, LinkedIn, 360dialog inbound, web form) → **POST /api/v1/ingest** → dedupe, create/update Lead, log activity → trigger 60s response |
| **S2** | 60-Second First Response | S1 completion | **n8n** (after ingest): calls **OpenAI** for personalised message → **360dialog** (WhatsApp) + **SendGrid** (email) → update Lead stage to Contacted, create MessageLog |
| **S3** | AI Lead Qualifier | S1 + response | **n8n** (after S2): calls **OpenAI** for score (1–10) + reason → update Lead (leadScore, scoreReason) → route: HOT (7–10) → Slack + fast track; WARM (4–6) → S4; COLD (1–3) → tag + S7 queue |
| **S4** | 7-Touch Follow-Up Engine | S3 (no booking yet) | n8n scheduled + FollowUpQueue: 7 touches (timing/channel per guide), OpenAI per touch, 360dialog/SendGrid, update FollowUpQueue; stop if booked |
| **S5** | Booking Confirm + Reminders | Calendly webhook (booking made) | n8n Calendly webhook → update Lead (pipelineStage, bookingId), skip pending S4 → WhatsApp + email confirm → 24h + 1h reminders → Slack #bookings |
| **S6** | No-Show Recovery | Calendly (no-show) | n8n: detect no-show (webhook or scheduled check) → update Lead → WhatsApp recovery message → 3-touch recovery queue → Slack #no-shows |
| **S7** | Dormant Reactivation | Airtable scheduled (30/60/90d) | n8n scheduled: find leads (lastContactDate &gt; 30d, not Client/Dead, reactivationAttempt &lt; 3) → branch by 30/60/90d → OpenAI message → 360dialog → update reactivationAttempt |
| **S8** | Audit Booking Flow | Tally/Typeform (audit-specific form) | Dedicated “audit request” path: form POST → ingest → **n8n** runs S8 flow: personalised “we’ve reviewed your form” message (OpenAI) → WhatsApp + email with **Calendly link** → OpenAI team brief → Slack #hot-leads with brief + link (see S8 deep dive below). |
| **S9** | Internal Slack Alerts | Hot lead / booking / no-show | **n8n** posts to **#hot-leads**, **#bookings**, **#no-shows**, **#system-errors** per scenario (S3, S5, S6, errors) |
| **S10** | Weekly Pipeline Report | Sunday 18:00 | n8n scheduled: query backend (or DB) for weekly metrics → format → Slack #pipeline-report (+ optional Google Sheets row) |
| **S11** | Social DM Lead Tracker | Manual entry | Same ingest API: manual form or internal form POST to ingest URL with _channel/source → triggers S2, S3 |
| **S12** | Paid Ad Lead Capture | Facebook/LinkedIn webhook | n8n receives Meta/LinkedIn webhooks → normalise (full_name vs firstName+lastName) → **POST /api/v1/ingest** → same as S1 |

---

## S8 (Audit Booking Flow) — what it means and what our system does

**What S8 is:** In the Make guide, S8 is the flow for when someone **explicitly requests the Revenue Leak Audit** — they’re not just a generic “contact us” lead; they’ve filled a **dedicated form** (e.g. Tally or Typeform) whose fields are tailored to the audit: name, company, phone, email, monthly enquiry volume, average project value, biggest challenge, etc. That form submission is high-intent: they’re asking for the audit, so we treat them as “Audit Requested” and move them quickly to booking.

**What our system does to achieve it:**

1. **Capture**  
   We give Social Funnel **one dedicated webhook URL** for “audit form” submissions (e.g. `POST /api/v1/webhooks/web-form` with a body that includes a flag like `form_type: "audit"` or we use a separate path like `/api/v1/webhooks/audit-form`). Alternatively the same web form URL as S1 but with a field that identifies the form as the audit form. Either way: the payload hits our backend (ingest) so we create or update the lead and set pipeline stage (e.g. “Audit Requested”) and tag (e.g. Hot).

2. **n8n runs the S8 flow**  
   When ingest completes (or when n8n receives the webhook if we use n8n as the receiver for this form), **n8n** runs the S8-specific sequence:
   - **OpenAI:** Generate a short, personalised message that references their **specific form answers** (e.g. “We’ve reviewed your answers — your biggest challenge around [X] is exactly what we help with…”). This is the “we’ve reviewed your form” message from the guide.
   - **360dialog:** Send that message via **WhatsApp** and include the **Calendly booking link** for the audit call.
   - **SendGrid:** Send the same (or similar) message by **email** with the Calendly link so they can book even if they’re not on WhatsApp.
   - **OpenAI (again):** Generate a **team brief** (~100 words): a prep note for the Social Funnel team that summarises the lead’s form answers (enquiry volume, project value, challenge) so the team is prepared for the audit call.
   - **Slack:** Post to **#hot-leads** (or a dedicated channel) with: lead name, company, lead score, the team brief, key form answers, and the Calendly link. So the team sees “new audit request” and can prep.

3. **Hand-off to S5**  
   Once they book via Calendly, the **Calendly webhook** fires and **n8n** runs **S5** (booking confirmation, 24h and 1h reminders, update pipeline stage to Audit Booked). So S8 doesn’t “own” the booking step — it gets them to the link; S5 handles the actual booking event.

**In short:** S8 = **dedicated “audit request” form → ingest → n8n sends personalised “we’ve reviewed your form” message + Calendly link (WhatsApp + email) → n8n generates team brief and posts to Slack** so the team can prep. No separate “account” for S8; we use the same ingest, OpenAI, 360dialog, SendGrid, Calendly, and Slack. The only special is the **form_type/audit-form path** and the **n8n branch** that runs the personalised message + brief + Slack alert instead of the generic S2 only.

---

## Part 2 accounts (Make guide) → Our checklist

| Make guide | Our ACCOUNTS_SETUP_CHECKLIST |
|------------|------------------------------|
| Make.com | **n8n** (we use self-hosted n8n instead; no Make account) |
| Airtable | **Our backend** (Prisma + PostgreSQL) — see WHY_CUSTOM_BACKEND_VS_AIRTABLE_HUBSPOT.md |
| OpenAI | **Part 5 — OpenAI** (same: API key, spend limit) |
| 360dialog + WABA | **Part 2 — WhatsApp** (same: 360dialog, WABA, inbound webhook) |
| Facebook Business Manager | **Part 1 — Meta** (BM, Page, Ad Account, Developer App, Lead Ads + optional DMs) |
| Calendly | **Part 6 — Calendly** (same: account, event type, webhook, API token) |
| SendGrid | **Part 3 — Email** (same: domain auth, API key, From address) |
| Slack | **Part 7 — Slack** (same: workspace, channels, app or webhook) |
| LinkedIn | **Part 4 — LinkedIn** (we use native webhook; guide had Zapier bridge or polling) |

---

## Key details we’re implementing (from the guide)

- **60s first response:** WhatsApp (primary) + email (fallback); message from **OpenAI** (gpt-4o-mini), max ~250 tokens, warm/professional, one question.
- **Lead scoring:** OpenAI returns JSON `{ "score": number, "reason": string }`; criteria: paid ad, company name, business email, specific service mention, WhatsApp inbound, etc.
- **7-touch sequence:** Day 1 (4h after S2) WA, Day 2 email, Day 3 WA, Day 4 email, Day 5 WA, Day 6 email, Day 7 WA; angles per guide (pipeline ratio, content, social proof, audit link, urgency, farewell).
- **Slack channels:** #hot-leads, #bookings, #no-shows, #pipeline-report, #system-errors.
- **No-show:** Recovery message within ~15 min, rebook link, 3-touch recovery sequence.
- **Dormant:** 30d / 60d / 90d; max 3 reactivation attempts; then mark Dead.
- **Calendly:** invitee.created → confirm + 24h + 1h reminders; no-show handling per S6.

---

*Use this file alongside the full .txt when building n8n workflows and backend logic. The .txt remains the source of truth for copy angles, scoring criteria, and timing.*
