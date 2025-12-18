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

3. Run the development server

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

When running behind a proxy/load balancer set `NODE_ENV=production`. The server automatically enables `trust proxy`, secure cookies, and HSTS in that mode.

Routes
------

- `GET /` — Membership portal landing page (EJS)
- `GET /about` — Placeholder informational page (EJS)
- `GET /api/health` — JSON healthcheck used for monitoring

Operational Notes
-----------------

- Pino logs include the `requestId` for correlating responses with server-side errors.
- CSRF tokens are exposed as `csrfToken` in the EJS layout; include them in any future forms.
- Run `npm run check:csrf` after editing EJS templates to ensure every form includes CSRF markup.
- Follow `docs/CSP-UPDATES.md` whenever the Content Security Policy needs to be adjusted.
- Monitor `/api/health` for readiness and backing-service status.
