UAW Local 1284 Membership Server
================================

This service powers the membership portal for UAW Local 1284. It provides a secure Express 5 backend with EJS views so we can build self-service pages for dues status, roster updates, and steward tools while keeping the operational footprint familiar.

Features
--------

- Express 5 + Helmet with strict CSP, rate limiting, and CSRF protection
- Session management backed by MongoDB (via `connect-mongo`)
- Structured logging with Pino and per-request correlation IDs
- `/api/health` endpoint that reports environment, build version, and backing service status
- Shared EJS layout with Local 1284 branding for member/admin views
- MongoDB (via Mongoose) for roster and membership data

Project Structure
-----------------

- `server/` — Express app (routes, middleware, config)
- `client/` — EJS views and static assets served by the app

Getting Started
---------------

1. Copy the example environment file and adjust values as needed

   ```sh
   cp .env.example .env
   ```

2. Install dependencies

   ```sh
   npm install
   ```

3. Run database migrations (creates required indexes)

   ```sh
   npm run migrate
   ```

4. Run the development server

   ```sh
   npm run dev
   ```

   The server listens on http://localhost:3000 by default.

Running MongoDB Locally
-----------------------

The repository includes a `docker-compose.yml` that bootstraps MongoDB with a persistent volume:

```sh
docker compose up -d
```

With the container running, ensure your `.env` file points to it (examples provided in `.env.example`). The default `MONGO_URI` is `mongodb://127.0.0.1:27017/uaw1284-membership`, which matches the published port from the compose stack.

Configuration
-------------

| Variable         | Description                                                                 |
|------------------|-----------------------------------------------------------------------------|
| `NODE_ENV`       | `development` (default) or `production`.                                    |
| `PORT`           | Port to bind (defaults to `3000`).                                          |
| `SESSION_SECRET` | Required in all environments; must be unique and strong in production.      |
| `MONGO_URI`      | MongoDB connection string used by Mongoose and the session store.           |
| `LOG_LEVEL`      | Optional Pino log level (`debug`, `info`, etc.).                            |

Additional security, monitoring, rate-limit, and logging toggles are documented in `.env.example`, `docs/LOGGING.md`, and `docs/MONITORING.md`.

When running behind a proxy/load balancer set `NODE_ENV=production`. The server automatically enables `trust proxy`, secure cookies, and HSTS in that mode.

Routes
------

- `GET /` — Membership portal landing page (EJS)
- `GET /about` — Placeholder informational page (EJS)
- `GET /admin/audit` — Admin UI listing the 50 most recent audit entries
- `GET /api/health` — JSON healthcheck (combined status)
- `GET /api/health/live` — Lightweight liveness probe
- `GET /api/health/ready` — Readiness probe including Mongo status
- `GET /api/metrics` — Prometheus-compatible metrics endpoint
- `GET /api/auth/*` — Login/password-reset APIs (JSON)
- `POST /api/admin/actions` — Example admin action endpoint
- `GET|POST /api/members/*` — CRUD and export endpoints for roster records (with audit logging)

Demo Accounts & Roles
---------------------

| Role | Email | Password | Capabilities |
| --- | --- | --- | --- |
| `admin` | `admin@local1284.org` | `ChangeMe123!` | Full access to admin actions, member CRUD/export, audit UI |
| `staff` | `staff@local1284.org` | `Steward456!` | Member CRUD, view audit UI |
| `readOnly` | `viewer@local1284.org` | `Viewer789!` | Read-only API access (no member mutations or admin routes) |

Roles are enforced both at the API layer (`requireAuth` + `requireRole`) and in the UI header, which hides restricted links unless the current session grants access.

Operational Notes
-----------------

- Structured JSON logs include the `requestId`, HTTP metadata, and userId (when available); configure rotation/shipping via `docs/LOGGING.md`.
- Health probes, metrics, and error monitoring are documented in `docs/MONITORING.md`.
- CSRF tokens are exposed as `csrfToken` in the EJS layout; include them in any future forms.
- Navigation automatically hides admin-only actions for users without the proper role.
- Run `npm run check:csrf` after editing EJS templates to ensure every form includes CSRF markup.
- Follow `docs/CSP-UPDATES.md` whenever the Content Security Policy needs to be adjusted.
- Monitor `/api/health` for readiness and backing-service status.
- Use `npm run migrate` before each deployment to apply schema/index migrations stored under `server/migrations/`.
