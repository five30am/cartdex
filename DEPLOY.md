# RomVault — Deployment Guide

## v1 ROM Management Feature Deployment (2026-04-14)

This covers deploying the dedup/hide/trash/audit feature. All steps run on the
Docker host (10.10.5.252) as root unless noted.

---

### 1. Pull updated image

The GitHub Actions runner builds a new image on push to main. Wait for the
workflow to complete (check https://github.com/five30am/romvault/actions).

```bash
docker pull ghcr.io/five30am/romvault:latest
```

---

### 2. Copy updated compose file to host

From the Claude VM:

```bash
scp ~/projects/romvault/docker-compose.yml root@10.10.5.252:/opt/romvault/docker-compose.yml
```

The only change is `/mnt/roms:/roms:rw` (was `:ro`). This is the mount flip.

---

### 3. Recreate container

```bash
ssh root@10.10.5.252 "cd /opt/romvault && docker compose up -d --force-recreate"
```

The schema migration runs automatically at startup (`ensureSchema()`). No manual
SQL needed. Check logs to confirm:

```bash
ssh root@10.10.5.252 "docker logs romvault --tail 30"
```

Look for: no ERROR lines, and the app should reach "ready on port 3000".

---

### 4. Verify write access

```bash
ssh root@10.10.5.252 "docker exec romvault touch /roms/.trash/.write-test && echo 'rw confirmed' && docker exec romvault rm /roms/.trash/.write-test"
```

If this fails with "Read-only file system", the NFS share on Unraid needs to be
checked — the host-level mount at `/mnt/roms` must be read-write.

---

### 5. Install auto-purge cron script

```bash
# Copy script to host
scp ~/projects/romvault/scripts/purge-trash.sh root@10.10.5.252:/opt/romvault/scripts/purge-trash.sh
ssh root@10.10.5.252 "chmod +x /opt/romvault/scripts/purge-trash.sh"

# Add to root crontab (opens editor — add the line below)
ssh root@10.10.5.252 "crontab -e"
```

Add this line:
```
0 3 * * * /opt/romvault/scripts/purge-trash.sh >> /var/log/romvault-purge.log 2>&1
```

Verify it's there:
```bash
ssh root@10.10.5.252 "crontab -l | grep purge"
```

Test run (dry mode):
```bash
ssh root@10.10.5.252 "DRY_RUN=1 /opt/romvault/scripts/purge-trash.sh"
```

---

### 6. Smoke test

Open RomVault in the browser and verify:
- "Duplicates" and "Trash" appear in the nav
- Audit Log icon (clipboard) appears next to Settings gear
- `/duplicates` loads without error (may show "No duplicates found" if library is clean)
- `/trash` loads with "Trash is empty"
- `/audit` loads with "No audit records yet"

---

### Rollback

If anything goes wrong:

```bash
# Revert compose to :ro mount and restart
ssh root@10.10.5.252 "
  sed -i 's|/mnt/roms:/roms:rw|/mnt/roms:/roms:ro|' /opt/romvault/docker-compose.yml
  cd /opt/romvault && docker compose up -d --force-recreate
"
```

The schema changes are purely additive — rolling back the image to a previous tag
is safe. Old code ignores the new columns and tables.

---

### Notes

- The `.trash/` directory lives at `/mnt/roms/.trash/` on the host (same NFS share).
  It is NOT inside the Docker volume — it's on the Unraid array alongside the ROMs.
- The purge script operates on `/mnt/roms/.trash/` directly (host path). If the
  NFS mount path changes on the host, update `TRASH_ROOT` in the cron entry or
  set it as an env var: `TRASH_ROOT=/new/path /opt/romvault/scripts/purge-trash.sh`
- DB path on host: `/var/lib/docker/volumes/romvault_data/_data/romvault.db`
  (useful if you need to inspect the DB directly with sqlite3)
