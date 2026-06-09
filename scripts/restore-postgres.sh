#!/usr/bin/env bash
# Restore Acquisition OS database from a pg_dump custom-format file.
#
# Usage:
#   DATABASE_URL="postgresql://..." ./scripts/restore-postgres.sh /path/to/acquisition_os_YYYYMMDD.dump
#
# WARNING: This drops and recreates objects in the target database depending on dump flags.
# Prefer restoring to a fresh database or staging first.

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

DUMP_FILE="${1:-}"
if [[ -z "$DUMP_FILE" || ! -f "$DUMP_FILE" ]]; then
  echo "Usage: DATABASE_URL=... $0 /path/to/backup.dump" >&2
  exit 1
fi

echo "About to restore: $DUMP_FILE"
echo "Target: $DATABASE_URL"
read -r -p "Type RESTORE to continue: " CONFIRM
if [[ "$CONFIRM" != "RESTORE" ]]; then
  echo "Aborted."
  exit 1
fi

pg_restore --dbname="$DATABASE_URL" --clean --if-exists --no-owner --no-acl "$DUMP_FILE"

echo "[restore] Complete. Run prisma migrate deploy if schema drift is suspected."
