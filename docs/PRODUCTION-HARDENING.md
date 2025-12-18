
# Production Hardening Checklist  
_For the UAW 1284 Membership Server_

This document outlines the recommended phases and steps to prepare this template for a production-ready deployment running the real UAW membership & CRM system.  
Use this as a working checklist — update it as items are completed.

---

# Phase 1 – Core Hardening & Configuration

## 1. Environment & Configuration
- [x] Enforce required environment variables in production (`MONGO_URI`, `SESSION_SECRET`, etc.)
- [x] Add helper that validates required variables at startup
- [x] Expand config with `isDev`, `isTest`, `isProd`, shared TTL constants
- [x] Ensure `.env.example` matches all required values
- [x] Add `app.set('trust proxy', 1)` when behind reverse proxy

## 2. HTTP Security & Middleware
- [x] Add per-route rate limits (login, password-reset, admin actions)
- [x] Add schema validation using Zod/Joi/Yup for all request bodies
- [x] Implement password policies (min length, complexity)
- [x] Use bcrypt or argon2 for password hashing
- [x] Regenerate session ID after login (session fixation protection)
- [x] Validate secure cookie flags for production (`secure`, `httpOnly`, `sameSite`)

## 3. CSRF & CSP Hardening
- [ ] Document update process for CSP changes
- [ ] Review CSRF exemptions under `/api/*`
- [ ] Add tests or checks ensuring EJS forms correctly use `csrfToken`

---

# Phase 2 – Observability, Logging & Errors

## 4. Logging
- [ ] Switch logger to structured JSON (pino recommended)
- [ ] Ensure logs always include: `requestId`, method, URL, status, IP, userId (when available)
- [ ] Sanitize logs (no passwords, tokens, secrets)
- [ ] Implement log rotation or log shipping

## 5. Errors & Monitoring
- [ ] Add `/api/health/live` (process OK)
- [ ] Add `/api/health/ready` (Mongo and others OK)
- [ ] Add Prometheus-compatible metrics endpoint
- [ ] Track latency, error counts, throughput
- [ ] Integrate Sentry or Rollbar for error reporting
- [ ] Standardize JSON error format for API endpoints

---

# Phase 3 – Data Model, Integrity & Auditing

## 6. Database Schema & Indexing
- [ ] Create Mongoose models for:
  - [ ] `User` (staff/admin accounts)
  - [ ] `Member` (CID, UID, address, etc.)
  - [ ] `AuditLog`
- [ ] Add unique indexes (CID, UID, email)
- [ ] Add supporting indexes for query patterns
- [ ] Introduce database migration system

## 7. Auditing
- [ ] Create `AuditLog` model
- [ ] Log create/update/delete actions for members
- [ ] Log admin actions with timestamp, IP, before/after snapshots
- [ ] Build UI for admins to review audit logs
- [ ] Log CSV/data exports (who exported, what, when)

## 8. Authorization
- [ ] Add RBAC middleware (`requireRole`)
- [ ] Define roles: `admin`, `staff`, `readOnly`, etc.
- [ ] Guard admin routes with role checks
- [ ] Reflect permissions in UI (hide tabs/menus)

---

# Phase 4 – Deployment, Scaling & Resilience

## 9. Docker & Deployment
- [ ] Create production-ready Dockerfile (multi-stage, non-root)
- [ ] Add `.dockerignore`
- [ ] Add Nginx reverse proxy configuration (if applicable)
- [ ] Use PM2 or systemd if not containerized

## 10. Performance & Resource Controls
- [ ] Add request body size limits (`express.json({ limit: "1mb" })`)
- [ ] Enable gzip/brotli via proxy
- [ ] Cache static assets with hashed filenames
- [ ] Tune Mongo connection pool size / timeouts

---

# Phase 5 – Backups, Privacy & Ops Policy

## 11. Backup & Restore Strategy
- [ ] Daily MongoDB backups (full)
- [ ] Incremental/oplog backups (if supported)
- [ ] Quarterly restore verification in staging
- [ ] Add Disaster Recovery Procedure document

## 12. Privacy & Compliance
- [ ] Create data retention schedule for member records
- [ ] Apply data minimization principles
- [ ] Ensure encrypted storage for Mongo (volume-level or DB-level)
- [ ] Apply least-privilege DB accounts
- [ ] Add deletion/anonymization workflow (if needed)

---

# Appendix: Future Enhancements
- [ ] MFA for admin/staff logins  
- [ ] IP allowlisting for sensitive actions  
- [ ] Security scanning pipeline (npm audit, Dependabot, Snyk)  
- [ ] Add queue system for notifications/exports  
- [ ] Add API versioning (`/api/v1/...`)  

---

This checklist will evolve as new requirements emerge.  
Each checklist item should translate into a GitHub issue or milestone task.
