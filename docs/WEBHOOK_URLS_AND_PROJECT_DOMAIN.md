# Webhook URLs — What We Implemented & How to Use Them

This doc explains **what “creating the URLs” means**, lists **every webhook URL** your backend exposes (so you can give them to the Social Funnel contact at 10am), and describes **what field of work this project sits in**.

---

## 1. What “creating the URLs” means (the process)

**“Creating the URLs”** here means **adding HTTP endpoints** on your backend that:

1. **Accept requests from external platforms** (Meta, LinkedIn, 360dialog, Twilio, or a browser/form).
2. **Respond in the way each platform expects** so they keep sending events to us:
   - **Meta & LinkedIn:** They first send a **GET** request to check that we “own” the URL (verification). We respond with a specific value (e.g. return their `challenge` or an HMAC). Once that succeeds, they send **POST** requests with lead or message data.
   - **360dialog, web form, Twilio:** They only send **POST** requests (no GET verification). We parse the body and return `200 OK` quickly so they don’t retry unnecessarily.
3. **Do something useful with the payload:** For lead-related webhooks we **normalise** the payload (name, phone, email, source) and call the **same ingest logic** that `POST /api/v1/ingest` uses — so we create or update a lead and log activity. For Twilio we create/update a lead by caller ID and log a “missed_call” activity so n8n can send a follow-up later.

So we didn’t “create URLs” in the sense of registering a new domain or buying a link. We **implemented routes** in the backend (Node/Express) that listen on paths like `/api/v1/webhooks/meta-leadgen`. The **full URL** is then:

`https://<your-backend-host>/api/v1/webhooks/<path>`

For example, if the backend is deployed at `https://api.socialfunnel.agency`, then the Meta Lead Ads webhook URL is:

`https://api.socialfunnel.agency/api/v1/webhooks/meta-leadgen`

The **code** that “creates” these URLs lives in:

- **`apps/backend/src/routes/webhooks.ts`** — defines each path and handler (GET for verification, POST for receiving data).
- **`apps/backend/src/index.ts`** — mounts that router at `/api/v1/webhooks`, so the server actually responds on those paths.

When you deploy the backend and set `META_WEBHOOK_VERIFY_TOKEN` (and optionally `META_PAGE_ACCESS_TOKEN`, `LINKEDIN_CLIENT_SECRET`), the contact can point Meta, LinkedIn, 360dialog, Twilio, and forms at the URLs below and they will work.

---

## 2. When we use the webhook URLs (not during initial account setup)

**We are not doing anything that needs the webhook URLs right now.** Deploying the backend only for verification would add work without moving the build forward. So the plan is:

1. **Now (e.g. 10am and the coming days):** The contact does **all account setup that does not require our URLs** — Meta Business Manager, Page, Ad Account, Developer App (and linking/linking app to Business, permissions, install app on Page); 360dialog sign-up and WABA; SendGrid; LinkedIn Campaign Manager and Developer App; OpenAI; Calendly; Slack; Twilio if needed. He creates the accounts, gets API keys and tokens, and hands those over. He **does not** paste any Callback URL or Webhook URL into Meta, LinkedIn, 360dialog, or Twilio yet, because we don’t have a deployed URL to give him.

2. **After the build is finished and the backend (and n8n) are deployed:** We will have a public base URL. We then give him the full webhook URLs and the Meta verify token. He goes back into each platform and **then** does the “URL thing” — adds the Callback URL in the Meta app, registers the webhook in LinkedIn, sets the inbound webhook in 360dialog, and so on. Verification will work because the backend is live.

So: **nothing that depends on the URLs happens until the build is done and we’ve deployed.** The contact can still complete the bulk of the account setup and handover (credentials, tokens, IDs) in the meantime.

**When we do configure URLs (after deploy):** Meta and LinkedIn will only accept a URL they can reach from the internet (no localhost). Once the backend is deployed, we give the contact the public base URL and the list of paths; he pastes the full URLs into each platform and verification will succeed.

---

## 3. Full list of webhook URLs (used after we deploy)

Replace `<BACKEND_BASE>` with your **public** backend URL (deployed app or tunnel URL). Do **not** use `localhost` for Meta or LinkedIn — they cannot reach it.

| # | Path | Methods | Purpose | Give to |
|---|------|--------|--------|--------|
| 1 | `/api/v1/webhooks/meta-leadgen` | GET, POST | Facebook & Instagram **Lead Ads** verification + lead delivery | Meta app → Webhooks → Page → leadgen → Callback URL |
| 2 | `/api/v1/webhooks/meta-messenger` | GET, POST | **Messenger / Instagram DMs** verification + message delivery (optional) | Meta app → Messenger / Instagram → Webhooks |
| 3 | `/api/v1/webhooks/linkedin-leadgen` | GET, POST | **LinkedIn Lead Gen** verification + lead delivery | LinkedIn Developer App → Webhooks |
| 4 | `/api/v1/webhooks/whatsapp-inbound` | POST | **360dialog** inbound messages (someone messages the WABA number) | 360dialog dashboard → Webhook URL for “messages” |
| 5 | `/api/v1/webhooks/web-form` | POST | **Website / landing page forms** (generic lead intake) | Any form (Tally, Typeform, custom HTML) that POSTs JSON with name, phone, email, etc. |
| 6 | `/api/v1/webhooks/twilio-voice-status` | POST | **Twilio** call status (missed call, completed, etc.) for follow-up | Twilio phone number → Voice → Status Callback URL |

**Verify token for Meta (leadgen + messenger):**  
Set in backend env: `META_WEBHOOK_VERIFY_TOKEN` (e.g. a long random string). The contact must enter the **same** value in the Meta app when they set the Callback URL. Example: `acquisition-os-verify` (or something secret in production).

**Full URL examples (if BACKEND_BASE = `https://api.socialfunnel.agency`):**

- Meta Lead Ads: `https://api.socialfunnel.agency/api/v1/webhooks/meta-leadgen`
- LinkedIn: `https://api.socialfunnel.agency/api/v1/webhooks/linkedin-leadgen`
- WhatsApp inbound: `https://api.socialfunnel.agency/api/v1/webhooks/whatsapp-inbound`
- Web form: `https://api.socialfunnel.agency/api/v1/webhooks/web-form`
- Twilio status: `https://api.socialfunnel.agency/api/v1/webhooks/twilio-voice-status`
- Meta Messenger (optional): `https://api.socialfunnel.agency/api/v1/webhooks/meta-messenger`

So we now have **six** webhook endpoints (not just two). Two are for Meta (leadgen + messenger), one for LinkedIn, one for WhatsApp inbound, one for web forms, one for Twilio.

---

## 4. What field of work this project is in

This project sits at the intersection of:

- **RevOps (Revenue Operations)** — pipeline, stages, booking, no-show recovery, reporting.
- **Marketing / lead acquisition** — multi-channel capture (ads, web, WhatsApp, DMs, phone), 60-second response, lead scoring, nurture.
- **Sales automation / lead-to-booking** — from first touch to booked call/site visit with minimal manual steps.
- **Marketing technology (MarTech)** — integrating ad platforms (Meta, LinkedIn), messaging (WhatsApp, email), calendar (Calendly), AI (OpenAI), and notifications (Slack) into one system.

So you could describe it as:

- **RevOps / sales automation**, or  
- **Lead-to-booking / acquisition OS**, or  
- **Marketing and sales automation (MarTech)** for a service business (e.g. agency, real estate, construction).

It’s different from health tech (clinical workflows, compliance), DeFi (on-chain, wallets), real estate (listings, property), inventory/POS (stock, transactions). Here the focus is **lead capture → qualification → booking → follow-up** across many channels, with a single pipeline and clear handover to the team (Slack, dashboard). That’s closest to **RevOps + MarTech + sales automation**.

---

*Use this doc when you hand the URLs and verify token to the Social Funnel contact and when you describe the project’s domain to others.*
