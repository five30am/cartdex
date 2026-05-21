# CartDex

Self-hosted ROM library manager. Next.js 16 App Router + SQLite (better-sqlite3 + Drizzle).

Repo: `five30am/cartdex` | Image: `ghcr.io/five30am/cartdex:latest`

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deploy

See [DEPLOY.md](./DEPLOY.md) for the full production deployment procedure.

Build and push is handled by GitHub Actions on push to `main`. The self-hosted
runner on the Claude VM builds the Docker image, pushes to GHCR, and triggers
the Portainer webhook to redeploy.

## GitOps migration note

GitOps migrated 2026-04-14. Project renamed RomVault to CartDex 2026-05-21.
