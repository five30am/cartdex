#!/bin/bash
# purge-trash.sh — auto-purge ROM trash files older than RETENTION_DAYS
#
# Runs on the Docker host (10.10.5.252) as a daily cron job.
# Operates directly on the NFS-mounted path — no API calls, no Docker exec.
#
# Install (add to root crontab on 10.10.5.252):
#   0 3 * * * /opt/romvault/scripts/purge-trash.sh >> /var/log/romvault-purge.log 2>&1
#
# The script needs to be deployed to /opt/romvault/scripts/ on the host.
# See DEPLOY.md for the full deployment procedure.

set -euo pipefail

TRASH_ROOT="${TRASH_ROOT:-/mnt/roms/.trash}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DRY_RUN="${DRY_RUN:-0}"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] purge-trash: starting (retention=${RETENTION_DAYS}d, dry_run=${DRY_RUN})"

if [ ! -d "$TRASH_ROOT" ]; then
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] purge-trash: TRASH_ROOT not found: $TRASH_ROOT — skipping"
  exit 0
fi

# Count before
BEFORE=$(find "$TRASH_ROOT" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | wc -l)

# Find timestamp directories older than RETENTION_DAYS by mtime.
# The directory name encodes the trash timestamp (ISO-ish), but mtime is
# set at creation time so it reliably tracks age.
EXPIRED=$(find "$TRASH_ROOT" -maxdepth 1 -mindepth 1 -type d -mtime "+${RETENTION_DAYS}" 2>/dev/null || true)

if [ -z "$EXPIRED" ]; then
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] purge-trash: no expired directories found (total: ${BEFORE})"
  exit 0
fi

PURGED=0
while IFS= read -r dir; do
  if [ "$DRY_RUN" = "1" ]; then
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] purge-trash: DRY RUN — would remove: $dir"
  else
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] purge-trash: removing: $dir"
    rm -rf "$dir"
  fi
  PURGED=$((PURGED + 1))
done <<< "$EXPIRED"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] purge-trash: done — purged ${PURGED} director$([ $PURGED -eq 1 ] && echo 'y' || echo 'ies')"
