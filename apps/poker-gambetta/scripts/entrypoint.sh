#!/bin/sh
set -e
cd /app/server
npx prisma migrate deploy
node dist/seed.js 2>/dev/null || true
cd /app
exec node server/dist/index.js
