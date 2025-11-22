Template Server
===============

Minimal client/server scaffold based on your Express + EJS project. It includes:

- Express 5 server with Helmet (strict CSP) and rate limiting
- Structured logging with Pino and request correlation IDs
- Sessions backed by Redis in production, memory store for development
- CSRF protection for server-rendered routes
- Enhanced healthcheck endpoint at `/api/health` (environment, version, services)

Project Structure
-----------------

- `server/` — Express app (routes, middleware)
- `client/` — EJS views and static assets (served by the server)

Getting Started
---------------

1. Copy `.env.example` to `.env` and adjust as needed

   cp template-server/.env.example template-server/.env

2. Install dependencies

   cd template-server && npm install

3. Run in development

   npm run dev

   Server: http://localhost:3000

Configuration
-------------

| Variable        | Description                                                |
|-----------------|------------------------------------------------------------|
| `NODE_ENV`      | `development` (default) or `production`.                   |
| `PORT`          | Port to bind (defaults to `3000`).                         |
| `SESSION_SECRET`| Required in all environments; must be unique in prod.      |
| `REDIS_URL`     | Required in production for session storage.                |
| `LOG_LEVEL`     | Optional Pino log level (`debug`, `info`, etc.).           |

When running behind a proxy/load balancer set `NODE_ENV=production` and provide `REDIS_URL` (e.g. `redis://localhost:6379`). The server automatically enables `trust proxy`, secure cookies, and HSTS in that mode.

Routes
------

- `GET /` — Home page (EJS)
- `GET /about` — Example page (EJS)
- `GET /api/health` — Healthcheck JSON

Notes
-----

- Pino logs include the `requestId` so you can correlate responses with server-side errors.
- CSRF tokens are automatically exposed as `csrfToken` in EJS layouts; include them in future forms.
- For production deployments, ensure Redis is reachable and monitor `/api/health` to track service readiness.
