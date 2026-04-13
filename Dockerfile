FROM node:22-alpine AS base

# Install build deps for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install runtime deps for native modules
RUN apk add --no-cache python3 make g++

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built app
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Data directory for SQLite DB + artwork (mount as volumes in production)
RUN mkdir -p /data && chown nextjs:nodejs /data
RUN mkdir -p /app/public/artwork && chown nextjs:nodejs /app/public/artwork

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# DB stored in /data volume; ROM files mounted at /roms by default
ENV DB_PATH=/data/romvault.db
ENV ROM_ROOT=/roms

# Metadata scraping credentials — set via docker-compose environment or -e flags
# SCREENSCRAPER_DEV_ID=
# SCREENSCRAPER_DEV_PASSWORD=
# TWITCH_CLIENT_ID=
# TWITCH_CLIENT_SECRET=

CMD ["node", "server.js"]
