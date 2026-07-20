#!/usr/bin/env bash
# install-hooks.sh
#
# Installs git pre-commit hooks for this repo. Runs automatically via
# `npm install` (the `prepare` lifecycle script).
#
# What gets installed:
#   1. check-gitleaks -- scans staged changes for secrets before every commit
#      (see scripts/check-gitleaks.sh, .gitleaks.toml). Added 2026-07-20,
#      backlog #1792, after hardcoded ScreenScraper dev credentials shipped
#      to source in this repo.
#
# To reinstall manually: npm run prepare  OR  bash scripts/install-hooks.sh
#
# Docker/CI guard: the Dockerfile's `deps` stage runs `npm ci` with ONLY
# package.json + package-lock.json in the build context -- no .git/, no
# scripts/. `prepare` still fires there, so this script must no-op cleanly
# (exit 0) instead of failing the install when there's no .git to hook into.
# This mirrors the same failure mode letsdance/musiclessons don't hit, since
# those deploy on Vercel/CF Pages where the full repo (incl. .git) is cloned
# before `npm install` ever runs.

set -euo pipefail

# Use `git rev-parse --git-dir` rather than testing for a `.git` directory:
# in a git *worktree* (this org's standard local-dev pattern, see
# Worktree Isolation in CLAUDE.md), `.git` is a file (gitlink) pointing at
# the shared common git dir, not a directory -- a directory-only check would
# false-negative and silently skip hook install for worktree-based dev.
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "[install-hooks] not inside a git repository (docker/CI build context) -- skipping hook install."
  exit 0
fi

# --git-path resolves correctly to the shared hooks dir in both a plain
# clone and a worktree.
HOOK_PATH="$(git rev-parse --git-path hooks/pre-commit)"

cat > "$HOOK_PATH" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail
bash "$(git rev-parse --show-toplevel)/scripts/check-gitleaks.sh"
HOOK

chmod +x "$HOOK_PATH"

echo "[install-hooks] pre-commit hook installed at $HOOK_PATH"
