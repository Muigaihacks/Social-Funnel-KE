#!/usr/bin/env bash
# Acquisition OS — PostgreSQL logical backup (pg_dump custom format).
# Run on the host that can reach the database (app server or cron user).
#
# Usage:
#   DATABASE_URL="postgresql://..." ./scripts/backup-postgres.sh
#   BACKUP_DIR=/var/backups/acquisition-os RETENTION_DAYS=14 ./scripts/backup-postgres.sh
#
# Requires: pg_dump (postgresql-client), DATABASE_URL in environment.

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-./backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
FILENAME="acquisition_os_${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

TARGET="${BACKUP_DIR}/${FILENAME}"
echo "[backup] Writing ${TARGET}"

pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="$TARGET"

# Optional: compress further (custom format is already compressed)
ls -lh "$TARGET"

echo "[backup] Pruning backups older than ${RETENTION_DAYS} days in ${BACKUP_DIR}"
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'acquisition_os_*.dump' -mtime "+${RETENTION_DAYS}" -delete

echo "[backup] Done."
