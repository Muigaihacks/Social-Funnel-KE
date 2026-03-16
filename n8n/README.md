# n8n — Acquisition OS

Self-hosted n8n for complete data ownership and complex branching (60-second response, 7-touch, scoring, Calendly, no-show recovery).

## Run with Docker

```bash
docker run -d \
  --name n8n \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  n8nio/n8n
```

Then configure workflows to call:

- `POST http://backend:4000/api/v1/ingest` for lead ingestion (with `_source` or `_channel` in body).
- Backend webhooks for 60s response, scorer, follow-up, and Calendly will be added in later phases.

## Env (when backend is in same network)

- `ACQUISITION_OS_BACKEND_URL=http://backend:4000`
