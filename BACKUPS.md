# Database Backups

SiteKeeper uses `pg_dump` to create compressed backups of all tenant databases. Backups run **outside Docker** — they connect to Postgres over TCP (`localhost:5435`) from the host, so backups survive even if the container is destroyed or recreated.

## How It Works

### Backup Script

**Location on server**: `/home/sitekeeper/app/infra/backup-db.sh`

The script:
1. Reads `backend/tenants.json` to discover all tenant databases
2. Runs `pg_dump` (custom format, compressed) for each database
3. Stores files in `/home/sitekeeper/backups/<label>/` with timestamps
4. Prunes old backups based on retention policy

### Backup Storage

```
/home/sitekeeper/backups/
├── daily/                          ← cron job (retained 30 days)
│   ├── 2026-05-23_030000_sitekeeper.sql.gz
│   └── 2026-05-23_030000_sk_nocoresources.sql.gz
├── pre-deploy/                     ← automatic before each deploy (retained 90 days)
│   ├── 2026-05-23_141500_sitekeeper.sql.gz
│   └── 2026-05-23_141500_sk_nocoresources.sql.gz
└── manual/                         ← ad-hoc backups (never auto-pruned)
    └── ...
```

### When Backups Run

| Trigger | Label | Retention |
|---------|-------|-----------|
| Cron (daily at 3:00 AM UTC) | `daily` | 30 days |
| Before every deploy (`deploy.sh`) | `pre-deploy` | 90 days |
| Manual invocation | `manual` (or custom) | Never auto-pruned |

### What Gets Backed Up

Every database listed in `backend/tenants.json`:
- `sitekeeper` — the default tenant database
- `sk_nocoresources` — NoCo Resources tenant database
- Any future tenant databases added to `tenants.json`

---

## Setup (One-Time on Server)

### 1. Install postgresql-client on the host

```bash
ssh awspantrypix "sudo apt-get update && sudo apt-get install -y postgresql-client-16"
```

This provides `pg_dump` and `pg_restore` on the host (outside Docker).

### 2. Create the backup directory

```bash
ssh awspantrypix "sudo -u sitekeeper mkdir -p /home/sitekeeper/backups/{daily,pre-deploy,manual}"
```

### 3. Set up the daily cron job

```bash
ssh awspantrypix "sudo -u sitekeeper crontab -e"
```

Add this line:

```cron
0 3 * * * /home/sitekeeper/app/infra/backup-db.sh daily >> /home/sitekeeper/backups/backup.log 2>&1
```

This runs the backup every day at 3:00 AM server time.

### 4. Verify the cron is saved

```bash
ssh awspantrypix "sudo -u sitekeeper crontab -l"
```

### 5. Test a manual backup

```bash
ssh awspantrypix "sudo -u sitekeeper /home/sitekeeper/app/infra/backup-db.sh manual"
```

Check the output and verify files were created:

```bash
ssh awspantrypix "ls -lh /home/sitekeeper/backups/manual/"
```

---

## Deploy Integration

The `deploy.sh` script automatically runs a pre-deploy backup before any backend deployment. This means you always have a restore point if a migration goes wrong.

- `./deploy.sh` → backup + backend + frontend
- `./deploy.sh backend` → backup + backend only
- `./deploy.sh frontend` → NO backup (frontend-only deploys don't touch the DB)

If the backup fails, the deploy continues with a warning (it won't block deploys).

---

## Restoring from a Backup

### Restore a single tenant database

SSH into the server and run the restore script:

```bash
ssh awspantrypix
sudo -u sitekeeper /home/sitekeeper/app/infra/restore-db.sh <backup_file> <database_name>
```

**Examples:**

```bash
# Restore the default tenant from a daily backup
sudo -u sitekeeper /home/sitekeeper/app/infra/restore-db.sh \
    /home/sitekeeper/backups/daily/2026-05-23_030000_sitekeeper.sql.gz \
    sitekeeper

# Restore nocoresources from a pre-deploy backup
sudo -u sitekeeper /home/sitekeeper/app/infra/restore-db.sh \
    /home/sitekeeper/backups/pre-deploy/2026-05-23_141500_sk_nocoresources.sql.gz \
    sk_nocoresources
```

The restore script will:
1. Stop the `sitekeeperapi` service (to release DB connections)
2. Terminate any remaining connections to the target database
3. Drop and recreate the database
4. Restore from the backup file
5. Restart the `sitekeeperapi` service

**You will be asked to type the database name to confirm** — this prevents accidental restores to the wrong database.

### Restore ALL tenant databases (full disaster recovery)

If you need to restore everything (e.g. after a catastrophic failure):

```bash
ssh awspantrypix

# Stop the API
sudo systemctl stop sitekeeperapi

# Restore each database from the same timestamp
TIMESTAMP="2026-05-23_030000"
BACKUP_DIR="/home/sitekeeper/backups/daily"

sudo -u sitekeeper /home/sitekeeper/app/infra/restore-db.sh \
    "$BACKUP_DIR/${TIMESTAMP}_sitekeeper.sql.gz" sitekeeper

sudo -u sitekeeper /home/sitekeeper/app/infra/restore-db.sh \
    "$BACKUP_DIR/${TIMESTAMP}_sk_nocoresources.sql.gz" sk_nocoresources

# Start the API
sudo systemctl start sitekeeperapi
```

### Manual restore without the script (emergency)

If the restore script isn't available (e.g. the repo isn't cloned yet):

```bash
# Connect to the server
ssh awspantrypix

# Stop the API
sudo systemctl stop sitekeeperapi

# Set Postgres connection vars
export PGHOST=localhost PGPORT=5435 PGUSER=sitekeeper PGPASSWORD=sitekeeper

# Terminate connections and drop/recreate
psql -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'sitekeeper' AND pid <> pg_backend_pid();"
psql -d postgres -c "DROP DATABASE IF EXISTS sitekeeper;"
psql -d postgres -c "CREATE DATABASE sitekeeper OWNER sitekeeper;"

# Restore
pg_restore --dbname=sitekeeper --no-owner --no-acl /home/sitekeeper/backups/daily/2026-05-23_030000_sitekeeper.sql.gz

# Restart
sudo systemctl start sitekeeperapi
```

---

## Monitoring & Troubleshooting

### Check backup logs

```bash
ssh awspantrypix "tail -50 /home/sitekeeper/backups/backup.log"
```

### List recent backups

```bash
ssh awspantrypix "ls -lht /home/sitekeeper/backups/daily/ | head -20"
```

### Check disk usage

```bash
ssh awspantrypix "du -sh /home/sitekeeper/backups/*"
```

### Verify a backup file is valid

```bash
ssh awspantrypix "pg_restore --list /home/sitekeeper/backups/daily/2026-05-23_030000_sitekeeper.sql.gz | head -20"
```

### Cron not running?

```bash
# Check if cron is installed and running
ssh awspantrypix "sudo systemctl status cron"

# Check sitekeeper user's crontab
ssh awspantrypix "sudo -u sitekeeper crontab -l"

# Check system mail for cron errors
ssh awspantrypix "sudo -u sitekeeper cat /var/mail/sitekeeper 2>/dev/null || echo 'No mail'"
```

---

## Retention Policy

| Category | Retention | Pruned by |
|----------|-----------|-----------|
| `daily/` | 30 days | Automatic (each backup run prunes old files) |
| `pre-deploy/` | 90 days | Automatic |
| `manual/` | Forever | Manual deletion only |

To change retention, edit the `prune_dir` calls at the bottom of `infra/backup-db.sh`.

---

## Disk Space Estimate

Each database backup is typically 50KB–5MB compressed (depending on data volume). With 2 tenants:
- Daily backups: ~10MB/month → ~120MB/year
- Pre-deploy backups: depends on deploy frequency, but similar order of magnitude

This is negligible on any modern server. If it ever becomes a concern, reduce retention or add S3 offloading.
