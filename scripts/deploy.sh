#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[deploy] pull latest code"
git pull --ff-only

echo "[deploy] install dependencies"
npm ci

echo "[deploy] build and migrate"
npm run deploy

if pm2 describe railsafety >/dev/null 2>&1; then
  echo "[deploy] restart app"
  pm2 restart railsafety
else
  echo "[deploy] start app"
  pm2 start ecosystem.config.cjs
fi

pm2 save
echo "[deploy] done"
