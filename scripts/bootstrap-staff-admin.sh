#!/usr/bin/env bash
# Create the first staff admin when the database has no users.
# Requires INTERNAL_AUTOMATION_SECRET and a running backend.

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:4000}"
SECRET="${INTERNAL_AUTOMATION_SECRET:-}"
EMAIL="${BOOTSTRAP_EMAIL:-admin@socialfunnel.agency}"
PASSWORD="${BOOTSTRAP_PASSWORD:-}"
NAME="${BOOTSTRAP_NAME:-}"

if [[ -z "$SECRET" ]]; then
  echo "ERROR: Set INTERNAL_AUTOMATION_SECRET" >&2
  exit 1
fi

if [[ -z "$PASSWORD" ]]; then
  echo "ERROR: Set BOOTSTRAP_PASSWORD (min 8 characters)" >&2
  exit 1
fi

PAYLOAD=$(node -e "
const o = { email: process.env.EMAIL, password: process.env.PASSWORD, secret: process.env.SECRET };
if (process.env.NAME) o.name = process.env.NAME;
console.log(JSON.stringify(o));
" EMAIL="$EMAIL" PASSWORD="$PASSWORD" SECRET="$SECRET" NAME="$NAME")

echo "[bootstrap] POST ${API_BASE}/api/v1/auth/bootstrap as ${EMAIL}"
curl -sS -X POST "${API_BASE}/api/v1/auth/bootstrap" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(JSON.stringify(j,null,2)); if(!j.ok) process.exit(1)"

echo ""
echo "Next: sign in at your dashboard /admin/login"
