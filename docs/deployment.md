# Deployment Specification

## Overview

Nova generates deployment-ready applications. This spec covers the Dockerfile and Docker Compose templates included in generated apps.

## Dockerfile

Generated at `<target>/Dockerfile`:

```dockerfile
# ============================================
# Multi-stage Dockerfile for Nova-generated app
# ============================================

# ─── Stage 1: Dependencies ───
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# ─── Stage 2: Builder ───
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js app
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

# ─── Stage 3: Runner ───
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

# Generate Prisma client for production
RUN npx prisma generate

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

## Docker Compose

Generated at `<target>/docker-compose.yml`:

```yaml
version: '3.9'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - '3000:3000'
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/nova_app
      - NEXTAUTH_URL=http://localhost:3000
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-change-me-in-production}
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: nova_app
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
```

## Next.js Config for Docker

Generated `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: true,
  },
};

module.exports = nextConfig;
```

## Environment Validation

Before deployment, the CLI validates required environment variables:

| Variable | Required When |
|----------|--------------|
| `DATABASE_URL` | Always |
| `NEXTAUTH_URL` | Auth enabled |
| `NEXTAUTH_SECRET` | Auth enabled |
| `GOOGLE_CLIENT_ID` | Google OAuth configured |
| `GOOGLE_CLIENT_SECRET` | Google OAuth configured |
| `GITHUB_CLIENT_ID` | GitHub OAuth configured |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth configured |
| `STRIPE_SECRET_KEY` | Billing enabled |
| `STRIPE_WEBHOOK_SECRET` | Billing enabled |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Billing enabled |

## Deployment Providers

### Vercel

```bash
nova deploy --provider vercel
```

Generates `vercel.json`:
```json
{
  "buildCommand": "pnpm run build",
  "outputDirectory": ".next",
  "framework": "nextjs"
}
```

### Railway

```bash
nova deploy --provider railway
```

Generates `railway.toml`:
```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "node server.js"
healthcheckPath = "/"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

### Fly.io

```bash
nova deploy --provider fly
```

Generates `fly.toml`:
```toml
app = "nova-app"
primary_region = "iad"

[build]
dockerfile = "Dockerfile"

[env]
PORT = "3000"

[http_service]
internal_port = 3000
force_https = true
auto_stop_machines = true
auto_start_machines = true
min_machines_running = 0
processes = ["app"]

[[vm]]
cpu_kind = "shared"
cpus = 1
memory_mb = 512
```

## Health Check Endpoint

Generated at `src/app/api/health/route.ts`:

```typescript
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', database: 'disconnected' },
      { status: 503 },
    );
  }
}
```

## Migration Strategy

On deployment, database migrations are run:

```bash
# In Dockerfile builder stage or deploy script
npx prisma migrate deploy
```

For zero-downtime deployments:
1. Run migrations before starting the new version
2. Use `prisma migrate deploy` (not `dev`)
3. Ensure backward-compatible schema changes
