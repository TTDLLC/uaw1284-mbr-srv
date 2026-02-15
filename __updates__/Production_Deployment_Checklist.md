# Production Deployment Checklist

## Environment Variables
- `NODE_ENV=production`
- `APP_URL` (https)
- `MONGODB_URI`
- `SESSION_SECRET`
- `CSRF_SECRET` (if configured separately)
- `EMAIL_PROVIDER` + `EMAIL_FROM` + provider token
- `SMS_PROVIDER` + Twilio credentials
- `SENTRY_DSN` (optional)

## Infrastructure
- MongoDB provisioned and reachable
- Reverse proxy / load balancer configured
- HTTPS enabled with valid certificates
- Ports/firewall rules updated

## Providers
- Email provider configured and tested
- SMS provider configured and tested

## Smoke Tests
1. Magic link login
2. Phone OTP verification
3. Notification test send
4. Announcements feed
5. Resources download
6. Events RSVP
7. Audit viewer/export

## Post-Deploy Verification
- `/healthz` returns 200
- `/readyz` returns 200
- Logs include request IDs
- Audit logs capturing create/update actions

## Rollback Plan
- Revert to previous deploy artifact
- Restore DB from latest backup if needed
