# Backup & Restore Strategy

This document explains how to protect the UAW 1284 membership database and verify that backups remain usable.

## 1. Daily Full Backups

Use `mongodump` to capture a full logical backup every 24 hours:

```sh
mongodump \
  --uri="$MONGO_URI" \
  --archive="/backups/uaw1284-$(date +%Y%m%d).gz" \
  --gzip
```

Operational notes:

- Run the job via `cron`, Kubernetes CronJob, or your preferred scheduler.
- Store archives in durable object storage (S3/Glacier, Azure Blob, etc.) with server-side encryption enabled.
- Retain at least 30 days of dailies; rotate older snapshots to cold storage per union policy.

## 2. Incremental / Oplog Capture

When running MongoDB replica sets (recommended for production), enable incremental backups by tailing the oplog:

- Use `mongodump --oplog` during the daily backup to produce an oplog slice tied to each full dump.
- Stream the oplog to the same storage bucket, or leverage managed tooling (e.g., AWS Backup for DocumentDB, MongoDB Cloud Backup, Percona Backup for MongoDB).
- Document the retention window for incremental files (e.g., 7 days) so point-in-time restores remain possible.

## 3. Quarterly Restore Verification

At least once per quarter:

1. Provision a staging MongoDB instance.
2. Restore the most recent full backup plus any necessary oplog files:
   ```sh
   mongorestore --uri="$STAGING_URI" --drop --archive=/path/to/full.gz --gzip
   # apply oplog if needed
   mongorestore --uri="$STAGING_URI" --oplogReplay --oplogFile=/path/to/oplog.bson
   ```
3. Run `npm run migrate` and a smoke test suite against the staging app.
4. Document the date, operator, and outcome in the ops logbook.

## 4. Disaster Recovery Procedure

Maintain a DR runbook so incident responders can rebuild the service quickly:

1. Declare incident & notify union stakeholders.
2. Provision replacement infrastructure (MongoDB + app hosts or Kubernetes cluster).
3. Restore the latest clean backup (see steps above).
4. Deploy the app image, load environment secrets, and update DNS/LB entries.
5. Conduct health checks (`/api/health/ready`, `/api/metrics`) and smoke tests before reopening access.
6. File a post-incident report summarizing RPO/RTO metrics and remediation steps.

## 5. Monitoring & Alerts

- Alert if the daily backup job fails or an archive is older than 24 hours.
- Alert if restore verification has not been logged within the last quarter.
- Track storage growth to plan for capacity expansions.

Keep this document updated as tooling or infrastructure evolves. Every backup job should have an associated ticket, log entry, or observability signal so auditors can confirm compliance.
