#!/usr/bin/env bash
# check-gitleaks.sh
#
# Pre-commit secret scan (gitleaks). Blocks the commit if a likely secret is
# detected in the staged diff.
#
# Added 2026-07-20 -- backlog #1792 (Vera). Two findings on 2026-06-08 (a JWT
# shipped in a build artifact on another project, and hardcoded ScreenScraper
# dev credentials in this repo's source) would both have been caught here at
# commit time instead of shipping to a live site. Low-cost, high-signal gate.
#
# Config: .gitleaks.toml in project root (default ruleset + allowlist for
# known false positives -- add new false positives there, not via bypass).
#
# Bypass (use only for a confirmed false positive not yet in the allowlist,
# and file/fix the allowlist entry in the same commit or immediately after):
#   SKIP_GITLEAKS_CHECK=1 git commit ...

set -euo pipefail

PROJECT_ROOT="$(git rev-parse --show-toplevel)"

if [ "${SKIP_GITLEAKS_CHECK:-0}" = "1" ]; then
  echo "[gitleaks] SKIP_GITLEAKS_CHECK=1 set -- skipping secret scan for this commit."
  exit 0
fi

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "[gitleaks] WARNING: gitleaks not installed on this machine -- skipping secret scan."
  echo "[gitleaks] Install: https://github.com/gitleaks/gitleaks#installing"
  exit 0
fi

if ! gitleaks protect --staged --redact --no-banner \
    --config "$PROJECT_ROOT/.gitleaks.toml" \
    --source "$PROJECT_ROOT"; then
  echo
  echo "[gitleaks] BLOCKED: possible secret detected in staged changes (see above)."
  echo "[gitleaks] If this is a real secret: remove it, rotate it, and re-stage."
  echo "[gitleaks] If this is a false positive: add a scoped allowlist entry to"
  echo "[gitleaks] .gitleaks.toml (path or regex) rather than bypassing."
  exit 1
fi
