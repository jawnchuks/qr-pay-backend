#!/bin/sh
set -e

echo "=== ENTRYPOINT SCRIPT STARTING ==="
echo "Current directory: $(pwd)"
echo "Listing files: $(ls -R)"

echo "Running database migrations..."
npx prisma migrate deploy || { echo "Migration failed!"; exit 1; }

echo "Seeding database..."
npx prisma db seed || { echo "Seeding failed!"; }

echo "Starting application..."
exec node dist/main.js
