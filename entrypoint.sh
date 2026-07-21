#!/bin/sh

echo "Running Prisma schema push..."
node node_modules/prisma/build/index.js db push --schema ./prisma/schema.prisma --skip-generate 2>&1 || echo "WARN: Prisma push failed, continuing anyway..."

echo "Starting application..."
exec node server.js
