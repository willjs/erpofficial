#!/bin/sh

echo "Running Prisma schema push..."
prisma db push --schema ./prisma/schema.prisma --accept-data-loss 2>&1 || echo "WARN: Prisma push failed, continuing anyway..."

echo "Starting application..."
exec node server.js
