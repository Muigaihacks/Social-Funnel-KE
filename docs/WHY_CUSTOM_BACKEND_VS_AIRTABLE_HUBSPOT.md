# Why We Chose a Custom Backend (Prisma + PostgreSQL) Over Airtable / HubSpot

The Make.com Build Guide (and similar no-code guides) often suggest storing leads in CRMs like **Airtable** or **HubSpot**. For Acquisition OS we use our **own backend** (Node.js + **Prisma** + **PostgreSQL**) as the single place we store and manage lead data. Here’s why that choice is a **strength** and how to explain it to Social Funnel (or other clients).

---

## 1. Full control over data and logic

- **Schema:** We define exactly which fields exist (lead type, budget, timeline, pipeline stage, lead score, etc.) and how they relate (e.g. activity logs, message logs, follow-up queue). No fighting CRM column limits or “views.”
- **Deduplication:** Our ingest logic (match by phone or email, append sources, update last contact date) is **deterministic** and in our code. We’re not dependent on a CRM’s duplicate rules or API behavior.
- **Pipeline stages and transitions:** We store every stage change with timestamps (e.g. `StageTransition`). That’s critical for reporting and automation; we control it end to end.
- **Compliance:** We can enforce Kenya DPA 2019, consent, and opt-out in one place, with clear audit trails (activity log, message log).

**Airtable/HubSpot:** You’re limited to their data model and duplicate handling; custom logic often requires workarounds or extra automation steps.

---

## 2. No per-seat or per-record CRM cost

- **HubSpot:** Free tier is limited; paid tiers are per-seat and can get expensive as the team grows. For a “clonable” product we’d need to factor CRM cost into every client deployment.
- **Airtable:** Pricing is per seat and per base; scaling across many clients or heavy usage can add up quickly.
- **Our backend:** One PostgreSQL database (or one per tenant if we multi-tenant). Hosting cost is predictable and doesn’t scale with “seats” or “records” in a SaaS CRM sense. We can offer a simpler, more predictable cost model for Social Funnel and future clients.

---

## 3. Single repo, single deployment, no third-party CRM as a dependency

- **Codebase:** Backend (ingest API, scoring, follow-up logic), frontend (dashboard), and n8n workflows are in **one repo**. New features and bug fixes don’t depend on Airtable/HubSpot releases or API changes.
- **Deployment:** We deploy our app and database; we don’t have to “sync” or “mirror” data into a separate CRM or keep two systems in sync.
- **Cloning for new clients:** We duplicate our schema and config (e.g. new tenant ID, new env vars). We don’t have to create new Airtable bases or HubSpot portals and reconfigure every integration.

---

## 4. Performance and reliability under our control

- **Ingest latency:** Our `/api/v1/ingest` endpoint does validation, normalization, deduplication, and DB write in one place. We can optimize queries and indexes (e.g. on `phone`, `email`, `tenantId`, `pipelineStage`) without being limited by a CRM’s API rate limits or response times.
- **60-second response:** We need to read the lead, (optionally) call OpenAI, and send WhatsApp/email quickly. Doing that against our own DB is predictable; depending on a third-party CRM API adds latency and failure modes.
- **Uptime:** Our availability depends on our hosting and our code, not on Airtable/HubSpot status pages or planned maintenance.

---

## 5. Data ownership and compliance (Kenya DPA, contracts)

- **Ownership:** All data lives in **Social Funnel’s** (or the client’s) database. There’s no “data in Airtable/HubSpot” that a vendor could lock or change terms on. The contract (Clause 13) requires accounts and systems to be under the Company’s control; our backend fits that model.
- **Compliance:** We can implement retention, deletion, and consent flows in one place and document them for Kenya DPA 2019 and any future audits.
- **Handover:** When the project ends, the client has the database and the code. They’re not tied to a specific CRM subscription to “keep” their pipeline.

---

## 6. Best fit for automation (n8n) and “glue” architecture

- **n8n’s role:** n8n is the **orchestrator** — it receives webhooks from Meta, LinkedIn, WhatsApp, web forms, Calendly, etc., and calls **one** backend API. We don’t need different Airtable/HubSpot APIs and field mappings per channel; we normalize once in n8n (or in the backend) and POST to `/api/v1/ingest`.
- **One source of truth:** Scoring, follow-up, booking, and Slack alerts all read from and write to the same Prisma/PostgreSQL layer. No “which system is correct?” or sync issues.
- **Future integrations:** Adding a new channel (e.g. another form, another ad platform) means one more webhook in n8n and the same ingest API. We don’t have to redesign a CRM base or portal.

---

## 7. Summary table — custom backend vs Airtable/HubSpot

| Aspect | Custom backend (Prisma + PostgreSQL) | Airtable / HubSpot |
|--------|--------------------------------------|---------------------|
| **Data model** | Full control; exact schema we need | Limited by product; workarounds for complex logic |
| **Deduplication** | Our logic, deterministic | Their rules; may need extra automation |
| **Cost** | Hosting + DB; predictable | Per-seat / per-base; can scale fast |
| **Deployment** | One app, one DB; easy to clone | New base/portal per client; more setup |
| **Performance** | We optimize queries and indexes | Subject to their API and limits |
| **Data ownership** | Data in client’s DB and control | Data in vendor’s systems |
| **Compliance** | We implement and document in one place | Depends on their features and policies |
| **n8n integration** | One ingest API; same for all channels | Different APIs and field maps per CRM |

---

**Bottom line for the client:**  
We chose a custom backend so Acquisition OS is **fast, predictable, and fully under your control** — with no ongoing per-seat CRM fees, no dependency on a third-party product for your core pipeline, and a clean path to clone the system for new clients. The automation (n8n) and all integrations (Meta, WhatsApp, SendGrid, Calendly, Slack, etc.) stay the same; the “brain” that stores and deduplicates leads is ours, not Airtable’s or HubSpot’s.
