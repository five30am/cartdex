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

set -euo pipefail

HOOK_PATH=".git/hooks/pre-commit"

cat > "$HOOK_PATH" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail
bash "$(git rev-parse --show-toplevel)/scripts/check-gitleaks.sh"
HOOK

chmod +x "$HOOK_PATH"

echo "[install-hooks] pre-commit hook installed at $HOOK_PATH"
