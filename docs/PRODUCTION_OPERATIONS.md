# Acquisition OS — production operations

Checklist for going live with client deployments and keeping data safe.

## Before client go-live (≈2 weeks)

- [ ] **Production env** on host (Railway, VPS, etc.): `DATABASE_URL`, `INTERNAL_AUTOMATION_SECRET`, Meta/WhatsApp/SendGrid/OpenAI keys, n8n webhook URLs documented in `docs/WEBHOOK_URLS_AND_PROJECT_DOMAIN.md`.
- [ ] **n8n workflows** tested end-to-end on staging with real-shaped payloads (ingest → score → follow-up → booking).
- [ ] **Dashboard** smoke test: sign in at `/admin/login`, lead list filters, **Add lead** (`/leads/new`), profile edits, follow-up queue, bookings, admin user create.
- [ ] **`JWT_SECRET`** and **`INTERNAL_AUTOMATION_SECRET`** set on API host (see `docs/STAFF_AUTH.md`).
- [ ] **Domain + TLS** for API and dashboard; webhook URLs updated in Meta/LinkedIn/360dialog.
- [ ] **Backups** scheduled (see below).

## Database backups

We use **logical backups** via `pg_dump` (custom format). Scripts live in `scripts/`:

| Script | Purpose |
|--------|---------|
| `scripts/backup-postgres.sh` | Daily (or hourly) dump + retention prune |
| `scripts/restore-postgres.sh` | Restore to a DB (staging drill recommended first) |

### Environment variables

| Variable | Default | Meaning |
|----------|---------|---------|
| `DATABASE_URL` | (required) | Postgres connection string |
| `BACKUP_DIR` | `./backups/postgres` | Where `.dump` files are written |
| `RETENTION_DAYS` | `14` | Delete dumps older than this |

### Example: cron on a VPS (daily at 02:15 UTC)

```cron
15 2 * * * cd /opt/social-funnel-KE && set -a && . /opt/social-funnel-KE/.env.production && set +a && BACKUP_DIR=/var/backups/acquisition-os RETENTION_DAYS=30 ./scripts/backup-postgres.sh >> /var/log/acquisition-os-backup.log 2>&1
```

Make scripts executable once:

```bash
chmod +x scripts/backup-postgres.sh scripts/restore-postgres.sh
```

### Off-site copy (recommended)

Cron only protects against app bugs, not disk loss. After each backup:

- **rsync/scp** `BACKUP_DIR` to S3-compatible storage, or
- Use your host’s managed DB backups (Railway, Supabase, RDS) **in addition** to `pg_dump`.

### Restore drill (do once before go-live)

1. Take a backup from staging/production.
2. Create empty database `acquisition_os_restore_test`.
3. `DATABASE_URL=... ./scripts/restore-postgres.sh /path/to/file.dump`
4. Point a local dashboard at that DB and open a known lead.

## Application deploy

Typical flow:

1. Merge to `main` → CI/build backend + frontend.
2. `npx prisma migrate deploy` on production (from `apps/backend`).
3. Restart API and Next.js processes.
4. Verify `/health` or ingest test lead.

## Multi-tenant / client instances

When deploying a **dedicated instance per client**:

- Separate `DATABASE_URL` (or `tenantId` scoping if shared DB).
- Separate n8n workspace or tagged workflows.
- Pass `x-tenant-id` from dashboard if using shared API (optional).

## Monitoring (lightweight)

- Uptime on `GET /health` (add if missing).
- n8n execution history for failed runs.
- Resend/SendGrid bounce logs for email follow-ups.

## Lead data from the dashboard

- **List filters**: `GET /api/v1/automation/leads?q=&stage=&channel=&minScore=&maxScore=&limit=&offset=`
- **Manual create**: `POST /api/v1/automation/leads` or UI at `/leads/new` (dedupes by phone/email like ingest).

---

*Update this doc when backup location or hosting provider changes.*
