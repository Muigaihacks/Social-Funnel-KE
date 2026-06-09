# Acquisition OS — Client onboarding playbook

**Product context:** [AcquisitionOS](https://acquisition-os.agency) is Social Funnel’s done-for-you **lead-to-booking operating system**, built for high-ticket service businesses (e.g. **construction, legal, real estate, consulting**). Each deployment uses the same **engine** (custom backend + PostgreSQL + n8n automation + integrations) but is **tailored** to the client’s channels, copy, cadence, and compliance context.

**Purpose of this document:** Tell the client **what we need from them** so we can deploy the system into their business: decisions, accounts, content, and technical access. **Commercial terms are handled separately** by Social Funnel.

**Next step after this document:** When the client has worked through the items here, **we send the Accounts Setup guide** — step-by-step instructions for opening each integration and gathering API keys and tokens (without pasting webhooks until our environment is live).

---

## 1. Principles

1. **Client-owned accounts**  
   Integrations (Meta, WhatsApp BSP, email provider, Calendly, OpenAI, etc.) are opened in the **client’s** (or jointly agreed) business identity, with credentials **documented and retained by the client**. No “only the implementer has the keys” end state.

2. **Context before go-live**  
   We do not paste webhooks or cut over until we understand **how the company sells** (sources, bottlenecks, handoffs, and any sector-specific rules for automated messaging).

3. **Primary response channel is per deployment**  
   Most clients lead with **WhatsApp** (360dialog + WhatsApp Business API). Some need **email-first** or stricter **email-only** touchpoints. Workflows use **placeholders**; we swap channel priority and copy per client.

4. **Seven-touch is configured per client**  
   Timing, channels, and angles are **not** generic. We need **written sign-off** on a v1 sequence.

5. **Webhooks after deploy**  
   The client can complete **account creation and credential handover** first. **Webhook URLs** are entered only once the backend (and n8n) are on a **public** host — the Accounts Setup guide explains that sequence.

6. **We are not building the core product per client**  
   We are **configuring and integrating** a proven stack. Calendar time is mostly **personalization depth**, **how fast the client returns inputs**, and **third-party approvals** (e.g. Meta verification), not greenfield engineering.

---

## 2. How long onboarding takes

**All timelines depend on how much personalization this company needs** (copy, channels, extra sources, compliance review) and **how quickly they open accounts and approve DNS**.

| Milestone | What to expect |
|-----------|----------------|
| **First client** | Plan for **up to 3 weeks** from the point we have a clear personalization spec and the client is actively provisioning accounts. |
| **Later clients** | As the process repeats, the same pattern typically **compresses toward about 2 weeks**, because templates, runbooks, and integrations are familiar. |
| **When inputs are complete** | The **technical integration and wiring** phase is often on the order of **about one week** once channels, seven-touch content, and credentials are ready — **provided** platform approvals (e.g. WhatsApp / Meta) do not block. |

**Things that add time (not always in our control):** Meta Business Verification, LinkedIn Marketing API approval, delayed DNS, legal review of automated copy, or a large number of bespoke flows.

---

## 3. Information we need from the client (alignment)

Hold this as a **conversation or short questionnaire** — whatever fits the relationship. Goal: one agreed **personalization spec** before heavy integration work.

**Business & pipeline**

- What they sell, typical **sales cycle shape** (short vs long consult), and **ideal vs disqualified** lead in plain language.  
- Where leads **enter today** (Meta, LinkedIn, web, WhatsApp inbound, phone, referrals).  
- **Bottlenecks** (slow response, no follow-up, no booking link, handoff gaps).  
- **Pipeline stage names** the team will actually use (mapped to the dashboard).  
- When a **human** must take over before automation continues; who should see **hot-lead** alerts and in which tool (Slack, Teams, etc.).

**Channels & content**

- **WhatsApp-first**, **email-first**, or **mixed** — and any rules on what automated messages **must not** say (especially regulated sectors).  
- **Seven-touch** v1: spacing, channel per step, and tone.  
- **Booking:** Calendly event types (or agreed scheduler), no-show handling.  
- **Brand:** legal name, short name, voice notes for messaging.

**Compliance & data**

- Data protection expectations (e.g. Kenya **KDPA**), retention, consent / opt-out for messaging.  
- Whether internal **legal review** is required before go-live copy.

**Success picture**

- Which **operational signals** matter week to week (e.g. lead → responded → booked → showed → won) so reporting matches how they run the business.

**Output:** A short **signed-off personalization summary** plus the checklist in **Section 6**.

---

## 4. What the client must **do** or **have** (accounts & access)

Scope is chosen from the list below per client; the **Accounts Setup** document has the click-by-click detail.

### 4.1 Lead capture

| Item | Client action | Notes |
|------|----------------|------|
| **Meta (Facebook & Instagram Lead Ads)** | Business Manager, Page, Ad Account, Developer App; later: webhook URL + verify token | Common for construction / real estate. |
| **Meta Messenger / IG DMs** (optional) | Same app; extra products + tokens | If inbound DMs matter. |
| **LinkedIn Lead Gen** | Campaign Manager + Developer App + webhooks | Common for legal / consulting. |
| **Website / landing forms** | Point forms to our **web-form** ingest URL (after deploy) | Any stack that can POST to a URL. |
| **WhatsApp Business (360dialog)** | WABA, phone number, **Meta business verification** as required | Often the **primary** channel. |

### 4.2 Messaging & email (60s + follow-ups)

| Item | Client action | **Options** |
|------|----------------|-------------|
| **Transactional email** | Domain + provider with API | **SendGrid**, **Resend**, or **Amazon SES** (see Accounts Setup for each). **Requirement:** verified **From** domain, API key, agreed **From** address. |
| **WhatsApp** | 360dialog API key + WABA number | Inbound webhook set **after** deploy. |
| **Optional: missed call** | **Twilio** number + status callback URL | Optional add-on. |

### 4.3 Intelligence & booking

| Item | Client action |
|------|----------------|
| **OpenAI** | Org billing + API key |
| **Calendly** (or agreed scheduler) | Event types, webhook to our URL, signing secret if applicable |

### 4.4 Internal notifications

| Item | Client action | **Options** |
|------|----------------|-------------|
| **Real-time team alerts** | Workspace + webhook or bot | **Slack**, **Microsoft Teams** (incoming webhook). |
| **Documentation** (optional) | Shared space for SOPs / copy | **Notion** or similar — **supplement** to chat alerts, not a full swap for urgent notifications unless we scope that explicitly. |

### 4.5 What we host

Social Funnel / implementer typically hosts: **application backend**, **PostgreSQL**, **n8n**, and the **dashboard** frontend. The client supplies **secrets**, **DNS** when using custom domains, and **approval** for processing lead data.

---

## 5. What we need **from** the client (non-account artifacts)

Before a **content freeze** for go-live:

| Artifact | Why |
|---------|-----|
| **Brand** | Legal name, short name, logo, voice notes. |
| **Approved sender identities** | WhatsApp display rules; email From name. |
| **Calendly links** | Per event type; tracking habits if any. |
| **Message templates (v1)** | 60s opener, each **touch**, booking confirm, reminders, no-show recovery; optional dormant reactivation. |
| **Disclaimers** | What automated messages must not claim (especially legal / regulated sectors). |
| **Lead field mapping** | Form fields → system fields; phone formats; dedupe rules. |
| **Escalation contacts** | Who to reach if automation errors or SLAs slip. |

---

## 6. Personalization checklist (per client snapshot)

Use one copy per deployment.

- [ ] **Primary outbound channel:** WhatsApp / Email / Both (order).  
- [ ] **Industry:** Construction / Legal / Real Estate / Consulting / Other: ______  
- [ ] **Lead sources in scope:** Meta / LinkedIn / Web / WhatsApp inbound / Calls / Other: ______  
- [ ] **Seven-touch:** timing grid (day offset + channel + angle summary).  
- [ ] **Scoring thresholds:** HOT / WARM / COLD cutoffs (defaults exist; confirm).  
- [ ] **Slack/Teams:** channels for leads, bookings, no-shows, errors.  
- [ ] **Pipeline stage labels** mapped to dashboard.  
- [ ] **Audit-style high-intent form** path needed? Y/N — form fields / URL.  
- [ ] **Dormant reactivation** in v1? Y/N — days and max attempts.  
- [ ] **Languages:** English only / bilingual — template plan.  

---

## 7. Deployment & webhook sequence (technical)

1. Deploy **backend** to a public base URL.  
2. Deploy **n8n** (reachable from WhatsApp / Calendly as required by the chosen architecture).  
3. Configure environment variables and secrets.  
4. Client enters **full webhook URLs** on Meta, LinkedIn, 360dialog, etc., as supplied by the implementer.  
5. **End-to-end tests** per enabled source.  
6. **Calendly:** test book / reschedule / no-show paths as implemented.  
7. **Freeze** workflow definitions for rollback reference.

---

## 8. Testing (UAT) — exit criteria

Joint sign-off when:

- [ ] At least **one successful lead** per **enabled** source.  
- [ ] **60-second** path on primary channel; email fallback if configured.  
- [ ] **Scoring** visible where expected.  
- [ ] **Follow-up** touches fire on schedule in a **safe** test mode.  
- [ ] **Booking** updates stages; reminders do not hit real prospects during test by mistake.  
- [ ] **Alerts** reach Slack/Teams (or agreed channel).  
- [ ] **Bad payloads** do not corrupt data; escalation path is known.

**Soak:** Where useful, **48–72 hours** of light traffic or parallel run before full cutover.

---

## 9. Training — admin dashboard & operations

Short session(s) with the **client team** who will operate the dashboard (often 2–3 hours total, split if needed).

| Module | Content |
|--------|---------|
| **Orientation** | What automates vs what stays human. |
| **Dashboard** | Leads, profile, stages, notes, follow-up queue, overrides. |
| **Sources & attribution** | How leads are labeled; duplicate behavior. |
| **Operational hygiene** | Passwords; API keys not shared in open chat; exports if any. |
| **Changes after launch** | How to request copy or timing updates. |
| **Incidents** | Degraded modes (e.g. WhatsApp down → email emphasis). |

**Deliverable:** Short **internal SOP** (1–2 pages) + link to this playbook (+ Notion/wiki if they use it).

---

## 10. Go-live & stabilisation

**Go-live checklist**

- [ ] Error monitoring path (n8n failures, API errors).  
- [ ] Database backup / restore verified.  
- [ ] Named people for **first two weeks** after go-live.  
- [ ] Rollback plan (pause webhooks / workflows if needed).

**Post go-live window**  
- Tight coordination for roughly **two weeks** while real traffic settles; log copy and cadence tweaks.

---

## 11. Email provider quick comparison

| Provider | Pros | Cons |
|----------|------|------|
| **Resend** | Fast setup, straightforward API, domain verification | Confirm deliverability needs for your region/volume. |
| **SendGrid** | Established, widely documented | Account and permission UI can feel heavy. |
| **Amazon SES** | Economical at scale inside AWS | More moving parts (SES, IAM, often SNS); slower first-time setup for non-AWS shops. |

**Always:** SPF/DKIM (or equivalent) on the sending domain and a **From** address people recognize.

---

## 12. Slack vs alternatives

| Approach | Best for |
|----------|----------|
| **Slack** | Immediate HOT lead, booking, and error alerts. |
| **Microsoft Teams** | Shops already on Microsoft 365 (incoming webhooks). |
| **Email digests** | Teams that avoid chat; slower loop. |
| **Notion** | Playbooks and copy libraries; optional logging — usually **alongside**, not replacing, realtime alerts unless explicitly built. |

---

## 13. One-page client summary (copy-paste email)

Subject: Acquisition OS — what we need to deploy your system

Hi [Name],

We’re preparing to deploy Acquisition OS for **[Company]** on your stack. Here is what we need from you:

1. **Answers** — how you attract leads today, preferred **WhatsApp vs email-first** outreach, pipeline language, handoff rules, and sign-off on a **seven-touch** v1 (we can propose a starter).  
2. **Accounts** — we will send our **Accounts Setup guide** once the above is clear. It walks through Meta/LinkedIn (if needed), WhatsApp (360dialog), **email sending** (**SendGrid, Resend, or AWS SES** on your domain), Calendly, OpenAI, and **Slack or Microsoft Teams**.  
3. **Approved messaging** — templates for first response, follow-ups, booking, reminders, plus any **must-not-say** lines for compliance.  
4. **Technical contact** — someone who can add **DNS records** and point forms to our URLs when we issue them.

**Timing:** Budget **up to about three weeks** for the **first** install while we polish the playbook together; repeats usually move **faster (often toward roughly two weeks)** as we reuse the same motions. Actual dates **always depend on how much tailoring you need** and how quickly integrations (especially Meta/WhatsApp approvals) complete.

Warm regards,  
[Social Funnel team]

---

*Maintained by Social Funnel / Acquisition OS implementers. Update when integration paths or provider choices change.*
