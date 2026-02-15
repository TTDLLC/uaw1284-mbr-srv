# Production Backup & Restore Plan

## Backup Strategy
- **Database:** MongoDB
- **Method (self-hosted):** `mongodump` on a scheduled job
- **Method (Atlas):** Atlas automated backups + daily snapshots
- **Frequency:** Daily full backup, retain at least 14 days
- **Storage:** Encrypted object storage (S3-compatible) with limited access

## Backup Procedure (self-hosted)
1. Create a dedicated backup user in MongoDB with read-only access.
2. Run:
   - `mongodump --uri="$MONGODB_URI" --out /backups/uaw1284-$(date +%F)`
3. Compress the dump:
   - `tar -czf /backups/uaw1284-$(date +%F).tgz /backups/uaw1284-$(date +%F)`
4. Upload to secure storage:
   - `aws s3 cp /backups/uaw1284-$(date +%F).tgz s3://<bucket>/uaw1284/`

## Restore Procedure
1. Provision a new MongoDB instance (or target environment).
2. Download the backup archive.
3. Extract the archive:
   - `tar -xzf uaw1284-YYYY-MM-DD.tgz`
4. Restore:
   - `mongorestore --uri="$MONGODB_URI" /path/to/uaw1284-YYYY-MM-DD`
5. Validate restore success:
   - Verify counts for `users`, `members`, `auditlogs`, `resources`, `events`.
   - Smoke test portal login and core workflows.

## Validation Checklist
- Confirm environment starts cleanly with restored DB.
- Verify admin login.
- Load portal and confirm members/events/resources are visible.
- Run a test RSVP and ensure data persists.

## Notes
- Store backups encrypted and restrict access to ops staff only.
- Confirm backup retention and cleanup tasks are in place.
