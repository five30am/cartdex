# Contributing to CartDex

CartDex is a hobby project. Contributions are welcome, but expectations are casual.

## Before opening a PR

- Check existing issues and PRs to avoid duplicate work.
- For significant changes, open an issue first to discuss direction.
- Bug fixes and small improvements can go straight to a PR.

## Development setup

```bash
git clone https://github.com/five30am/cartdex.git
cd cartdex
npm install
cp .env.example .env.local
# Edit .env.local with your local paths
npm run dev
```

The app runs at `http://localhost:3000`.

## Pull request guidelines

- Target the `main` branch.
- Keep commits focused. One logical change per PR is easiest to review.
- Include a clear description of what changed and why.
- If you add a new feature, update the README if it affects user-facing behavior.
- Run `npm run build` locally before opening a PR -- the CI will catch TypeScript
  and lint errors, but catching them early saves time.

## Code style

- TypeScript throughout. No `any` unless it is genuinely unavoidable.
- Tailwind for styling. Avoid inline styles.
- shadcn/ui components where applicable.
- Server components by default; client components only when interactivity
  requires it (`"use client"` at the top of the file).

## Schema changes

Database migrations run automatically via `ensureSchema()` in `lib/db/migrate.ts`.
Add new columns or tables there. Migrations must be idempotent (check-before-add).
Do not modify existing column definitions -- add new columns instead.

## Licensing

By submitting a pull request, you agree that your contribution will be licensed
under GPL-3.0, the same license as the rest of the project.

## Code of conduct

Be constructive. This is a small hobby project -- keep it friendly.
