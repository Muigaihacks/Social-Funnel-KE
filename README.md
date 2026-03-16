# Acquisition OS — Social Funnel (KE)

Proprietary **Lead-to-Booking Operating System** for Social Funnel. Every inquiry is captured, responded to in under 60 seconds, AI-qualified, and pushed to a booked call or site visit.

**Stack:** Node.js (TS) backend · Next.js dashboard · PostgreSQL (Prisma) · n8n · OpenAI GPT-4o-mini · WhatsApp (360dialog) · SendGrid

## Repo structure

- `apps/backend` — Webhooks, 60-second response engine, API (Node.js + TypeScript)
- `apps/frontend` — Real-time KPI dashboard (Next.js)
- `n8n/` — n8n config and self-host notes

## Quick start

```bash
# Install
npm install

# Copy env and set DATABASE_URL, etc.
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env.local

# DB
npm run db:push

# Run backend + frontend
npm run dev:backend   # port 4000
npm run dev:frontend  # port 3000
```

## Ingest webhook

`POST /api/v1/ingest` — Multi-channel lead ingestion (FB/IG, Web, WhatsApp, LinkedIn). Normalizes payloads into a single Lead schema and deduplicates by email or phone.

## License

Proprietary — Social Funnel. Third-party libraries MIT/Apache only.
