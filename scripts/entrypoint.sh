#!/bin/sh
set -e

echo "=== ENTRYPOINT SCRIPT STARTING ==="
echo "Current directory: $(pwd)"
echo "Listing files: $(ls -R)"

echo "Syncing database schema..."
npx prisma db push --skip-generate || { echo "DB Sync failed!"; exit 1; }

echo "Seeding database..."
npx prisma db seed || { echo "Seeding failed!"; }

echo "Starting application..."
exec node dist/main.js
