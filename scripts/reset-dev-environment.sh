#!/usr/bin/env bash
# Nuclear reset: build caches + all node_modules, then lockfile-clean install + Prisma.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Removing artifacts and node_modules..."
rm -rf node_modules apps/frontend/node_modules apps/backend/node_modules
rm -rf apps/frontend/.next apps/frontend/out
rm -rf apps/backend/dist

echo "==> npm cache verify..."
npm cache verify

echo "==> Clean install (package-lock.json)..."
if ! npm ci; then
  echo "npm ci failed — lockfile may be out of date. Run: npm install"
  exit 1
fi

echo "==> Prisma generate..."
npm run db:generate

echo "==> Verify critical packages..."
node scripts/verify-install.mjs

echo ""
echo "Done. Use two terminals:"
echo "  1) npm run dev:backend"
echo "  2) npm run dev:frontend"
