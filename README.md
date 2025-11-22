UAW Local 1284 Membership Server
================================

This service powers the membership portal for UAW Local 1284. It provides a secure Express 5 backend with EJS views so we can build self-service pages for dues status, roster updates, and steward tools while keeping the operational footprint familiar.

Features
--------

- Express 5 + Helmet with strict CSP, rate limiting, and CSRF protection
- Session management backed by Redis in production (in-memory for local dev)
- Structured logging with Pino and per-request correlation IDs
- `/api/health` endpoint that reports environment, build version, and backing service status
- Shared EJS layout with Local 1284 branding for member/admin views

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

3. Run the development server

   ```sh
   npm run dev
   ```

   The server listens on http://localhost:3000 by default.

Configuration
-------------

| Variable         | Description                                                                 |
|------------------|-----------------------------------------------------------------------------|
| `NODE_ENV`       | `development` (default) or `production`.                                    |
| `PORT`           | Port to bind (defaults to `3000`).                                          |
| `SESSION_SECRET` | Required in all environments; must be unique and strong in production.      |
| `REDIS_URL`      | Required in production for Redis-backed sessions.                          |
| `LOG_LEVEL`      | Optional Pino log level (`debug`, `info`, etc.).                            |

When running behind a proxy/load balancer set `NODE_ENV=production` and provide `REDIS_URL` (e.g. `redis://localhost:6379`). The server automatically enables `trust proxy`, secure cookies, and HSTS in that mode.

Routes
------

- `GET /` — Membership portal landing page (EJS)
- `GET /about` — Placeholder informational page (EJS)
- `GET /api/health` — JSON healthcheck used for monitoring

Operational Notes
-----------------

- Pino logs include the `requestId` for correlating responses with server-side errors.
- CSRF tokens are exposed as `csrfToken` in the EJS layout; include them in any future forms.
- In production, verify Redis connectivity before deploys and monitor `/api/health` for readiness.
