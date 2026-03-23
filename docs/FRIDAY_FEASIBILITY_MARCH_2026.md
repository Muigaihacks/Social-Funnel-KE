# Friday 20 March 2026 — Delivery Feasibility

**Assumption:** ~6–8 hours/day from Monday 16 March → **Mon–Fri ≈ 30–40 hours** total.

---

## Contract “done” (Schedule A + Clause 5)

- Lead capture from **≥ 3 channels** (e.g. FB/IG, Web, WhatsApp) with correct field mapping.
- **60-second response** engine (WhatsApp primary; email fallback) with lead stage update to “Contacted”.
- **AI qualification** (score/routing) and CRM updates.
- **7-touch follow-up** engine with branching and manual override.
- **Calendly** (or equivalent) booking, CRM update, confirmations.
- **No-show recovery** (e.g. within 15 min) with rebook link.
- **Nurture / reactivation** for dormant leads.
- **Dashboard:** lead count, source breakdown, response time, booking rate, pipeline stages, no-show rate.
- **Clonable** architecture and cloning docs.
- **14 days** stable run for final acceptance (can start after Fri 20th).

---

## Is Friday 20 March realistic?

**Short answer:** **Tight but possible** if:
1. **Accounts and credentials** (Meta, 360dialog, SendGrid, LinkedIn) are **created and handed over by Social Funnel early in the week** (ideally Mon–Tue).  
   Without them we cannot complete live FB/IG → ingest, WhatsApp 60s reply, or email fallback.
2. **Scope is strictly Phase 1:** internal Social Funnel build; no custom UI beyond what’s needed for the dashboard; no extra integrations.
3. **LinkedIn** is treated as **“if applicable”**: if credentials or API approval are delayed, we can still hit “≥ 3 channels” with FB/IG + Web + WhatsApp and document LinkedIn as follow-up.

**Rough time allocation (30–40 h)**

| Area | Hours | Notes |
|------|-------|--------|
| n8n: webhooks (FB/IG, web, WhatsApp) → ingest | 6–8 | Depends on Meta app + webhook URL being live. |
| Backend: 60s response (WhatsApp + email) | 4–6 | After 360dialog + SendGrid keys. |
| n8n: 7-touch + no-show + nurture logic | 6–8 | Core automation. |
| Calendly (or equivalent) integration | 3–4 | Webhook + CRM stage update. |
| AI qualification (scoring/routing) | 3–4 | Already have schema; need prompt + wiring. |
| Dashboard (KPIs, pipeline, sources) | 5–7 | Frontend + backend API. |
| Cloning docs + test plan + handover | 2–3 | Can be final day / post-Friday. |
| Buffer (bugs, webhook verification, approvals) | 4–6 | Critical. |

If account handover slips to Wed/Thu, the same work compresses into fewer days and **risk of missing Friday increases**. Prioritisation would be: (1) 3-channel capture + ingest, (2) 60s response, (3) follow-up engine, (4) booking, (5) dashboard, (6) no-show + nurture, (7) docs.

---

## Recommendation

- **Monday:** Confirm with Social Funnel that the **ACCOUNTS_SETUP_CHECKLIST** is with the right person and that **Meta (Lead Ads app), 360dialog/WABA, and SendGrid** are targeted for creation **by Tuesday EOD**.
- **Tuesday:** Target **first successful test**: one channel (e.g. web or FB test lead) → ingest → 60s WhatsApp or email reply.
- **Wed–Thu:** Roll out remaining channels, follow-up engine, Calendly, dashboard.
- **Friday:** Integration testing, dashboard polish, cloning and handover documentation; **delivery** of the internal system. The **14-day stability run** and formal **written acceptance** can follow in the next two weeks.

---

*This is an internal planning note; adjust as new constraints or priorities appear.*
