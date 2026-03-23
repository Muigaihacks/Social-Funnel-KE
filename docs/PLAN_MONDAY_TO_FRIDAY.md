# Plan: Monday → Friday (system ready)

**Goal:** 10am call set; then finish backend + n8n; deploy backend by Wednesday so the contact can add URLs and we confirm lead receipt; system ready by Friday.

---

## 10am call — we’re set

- **Accounts checklist** (`docs/ACCOUNTS_SETUP_CHECKLIST.md`) is ready to share. He does **all account setup that doesn’t need URLs** (Meta BM, Page, Ad Account, Developer App, link app, permissions, install on Page; 360dialog + WABA; SendGrid; LinkedIn; OpenAI; Calendly; Slack; Twilio if needed).
- **No URL steps yet:** He does **not** enter any Callback URL or Webhook URL in Meta, LinkedIn, 360dialog, or Twilio. We’ll send those after we deploy (target: Wednesday).
- **Handover:** He gives you credentials, API keys, tokens, and IDs as each account is ready (App ID/Secret, Page token, 360dialog key, SendGrid key, etc.).

---

## Day-by-day plan (today → Friday)

| Day | Focus | Outcomes |
|-----|--------|----------|
| **Mon (today)** | 10am call + backend/n8n foundation | Call done; accounts in progress; backend env and n8n project ready for the week. |
| **Tue** | Backend + n8n core | Ingest and webhooks solid; first n8n flow: webhook → ingest → (optional) 60s response stub. |
| **Wed** | Deploy backend + URL handover | Backend live; contact adds URLs; we verify we receive leads from each channel. |
| **Thu** | n8n scenarios + 60s response | Full S1–S2 (capture + 60s response); scoring (S3) and follow-up (S4) started. |
| **Fri** | Scenarios + dashboard + handover | 7-touch, Calendly, no-show, Slack; dashboard basics; system ready for acceptance. |

---

### Monday (today)

**10am**  
- Run the call using the checklist.  
- He creates/claims accounts and starts handover (credentials as he gets them).

**After the call**  
- **Backend:** Ensure `.env` is ready for the week (no secrets in repo): `DATABASE_URL`, `META_WEBHOOK_VERIFY_TOKEN`, and placeholders for `META_PAGE_ACCESS_TOKEN`, `LINKEDIN_CLIENT_SECRET`, 360dialog, SendGrid, OpenAI, Slack, Calendly when he sends them).  
- **n8n:** If not already done, get n8n running (e.g. Docker or cloud). Create one minimal workflow: Webhook (or “test”) → HTTP Request to `POST /api/v1/ingest` with a fixed payload to confirm the backend ingest works from n8n.  
- **Clarify:** List exactly which credentials you’re still waiting on after the call so you can chase them Tuesday if needed.

**By EOD Monday**  
- Checklist shared and call done.  
- Backend runs locally with current env.  
- n8n can call the backend ingest (at least in one test flow).  
- You know what’s left to build for Wed/Fri.

---

### Tuesday

**Backend**  
- Add any missing env vars as credentials arrive.  
- Confirm all six webhook routes work locally (Meta GET verify, LinkedIn GET verify, 360dialog POST, web-form POST, Twilio POST, Meta messenger GET/POST).  
- Optional: add a simple health or “webhooks ready” check for deploy.

**n8n**  
- **S1 equivalent:** For at least one channel (e.g. web form), n8n Webhook → map body → `POST /api/v1/ingest` with `_channel`. Test with a curl or form POST.  
- **S2 stub (optional):** After ingest returns, trigger a branch that will later call 360dialog/SendGrid; for now you can log or call a “ready for 60s” placeholder so the flow is there.  
- Document the n8n base URL you’ll use (or confirm we’re using backend URLs for webhooks for now).

**By EOD Tuesday**  
- Backend webhooks tested locally.  
- At least one end-to-end path: “something hits n8n or backend → ingest → lead in DB.”  
- Ready to deploy backend Wednesday.

---

### Wednesday

**Deploy backend**  
- Deploy the backend to a host (Railway, Render, Fly.io, or Social Funnel’s server).  
- Set env in production: `DATABASE_URL`, `META_WEBHOOK_VERIFY_TOKEN`, and all keys/tokens you have (Meta, LinkedIn, 360dialog, SendGrid, OpenAI, Slack, Calendly).  
- Confirm health and that the app starts without errors.

**URL handover**  
- Send the contact the **public base URL** and the **six webhook URLs** (see `docs/WEBHOOK_URLS_AND_PROJECT_DOMAIN.md`).  
- Send the **Meta Verify Token** (same value as `META_WEBHOOK_VERIFY_TOKEN`).  
- He adds: Meta leadgen (and optional messenger) callback + verify token; LinkedIn webhook; 360dialog inbound URL; Twilio Voice + Status Callback (if using).  
- He points any test form at the web-form URL.

**Verification**  
- **Meta:** He clicks Verify in the Meta app; our GET handler should return the challenge and show “Verified.”  
- **LinkedIn:** He registers the webhook; our GET handler should pass LinkedIn’s challenge.  
- **360dialog / Twilio / web form:** He saves the URLs; we trigger a test (send a test message, miss a call, submit the form) and confirm we get a POST and a new/updated lead in the DB (and activity log where applicable).

**By EOD Wednesday**  
- Backend is live.  
- Contact has added all URLs.  
- We’ve confirmed we can receive leads (or at least webhooks) from Meta, LinkedIn, 360dialog, web form, and Twilio as configured.

---

### Thursday

**n8n scenarios**  
- **S2 (60s response):** After ingest (or after webhook), n8n calls OpenAI for the first message, then 360dialog (WhatsApp) and SendGrid (email fallback); update lead stage to “Contacted” (via backend API or direct DB if you expose an endpoint).  
- **S3 (scoring):** After S2, n8n calls OpenAI for score + reason, updates lead (backend API or DB), branches HOT / WARM / COLD; HOT → Slack (#hot-leads).  
- **S4 (7-touch):** Start the 7-touch scheduler and first 1–2 touches (n8n scheduled or queue-based), using FollowUpQueue and backend.

**Backend**  
- Expose any small endpoints n8n needs (e.g. “update lead stage”, “log message”) if not already there.  
- Keep webhooks and ingest stable.

**By EOD Thursday**  
- New lead → ingest → 60s response (WhatsApp + email) → score → Slack for hot leads.  
- At least the beginning of the 7-touch sequence is wired.

---

### Friday

**n8n**  
- **S4:** Complete 7-touch logic (timing, channel alternation, stop if booked).  
- **S5:** Calendly webhook → update lead (Audit Booked), send confirmation + 24h/1h reminders.  
- **S6:** No-show detection (Calendly or scheduled check) → recovery message + rebook link, Slack #no-shows.  
- **S7 (optional):** Dormant reactivation (scheduled, 30/60/90d) if time allows.  
- **S9:** Ensure Slack alerts fire for hot leads, bookings, no-shows.  
- **S10 (optional):** Weekly pipeline report (Slack #pipeline-report) if time allows.

**Dashboard**  
- Basic KPI view: leads per day, by source, pipeline stage distribution, response-time indicator (e.g. “60s response sent” count).  
- Frontend calls backend APIs (or DB) for lead list and aggregates.  
- No need to be polished; enough to show the system is working.

**Handover and acceptance**  
- Run through: one lead from each channel (Meta, web form, WhatsApp inbound if 360dialog is set) → ingest → 60s response → score → Slack.  
- One booking flow (Calendly) and one no-show recovery.  
- Share dashboard link and a short “what we built” summary.  
- Confirm with the contact that URLs are all verified and leads are flowing; document any known gaps for the following week.

**By EOD Friday**  
- System is ready for acceptance: capture, 60s response, scoring, follow-up, booking, no-show recovery, Slack, basic dashboard.  
- Contact has URLs in place and we’ve confirmed we fully receive leads from all configured channels.

---

## One-line summary

| Day | One line |
|-----|----------|
| **Mon** | 10am call + checklist; backend/env + n8n test flow; know what’s missing. |
| **Tue** | Backend webhooks solid; n8n S1 (+ S2 stub); one channel end-to-end to ingest. |
| **Wed** | Deploy backend; give contact URLs; he adds them; we verify lead receipt from all channels. |
| **Thu** | n8n S2 (60s), S3 (score + Slack), start S4 (7-touch). |
| **Fri** | S4–S6–S9 (and optional S7/S10); dashboard; system ready; confirm full lead receipt. |

---

*Adjust any day if the call slips or credentials arrive late; Wednesday deploy + URL step is the main hinge so we can confirm lead receipt before Friday.*
