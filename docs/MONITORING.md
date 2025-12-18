# Monitoring & Health Endpoints

This service exposes multiple signals that operations teams can use to track uptime and quality of service.

## Health Endpoints

| Endpoint | Purpose | Behavior |
| --- | --- | --- |
| `GET /api/health/live` | Liveness probe | Returns immediately with process metadata. Use for Kubernetes/VM watchdogs. |
| `GET /api/health/ready` | Readiness probe | Includes Mongo connection status. Responds with HTTP 503 if dependencies are unavailable. |
| `GET /api/health` | Legacy combined status | Includes environment, timestamps, and dependency summary. |

All responses include `requestId`, `env`, `version`, `uptime`, and `services` arrays for quick debugging.

## Metrics

- `GET /api/metrics` exposes a Prometheus-compatible text payload using [`prom-client`](https://github.com/siimon/prom-client).
- Default metrics capture process stats plus custom counters/histograms for request rate, latency, and error counts (`http_requests_total`, `http_request_duration_seconds`, `http_request_errors_total`).
- Toggle collection via `METRICS_ENABLED` (default `true`). When disabled the endpoint returns HTTP 503.

Feed this endpoint into Prometheus, Grafana Agent, or any collector that understands the Prometheus text format.

## Error Reporting

Optional [Sentry](https://sentry.io/) integration captures uncaught exceptions and attaches `requestId`, request metadata, and user session info.

Configure via environment variables:

| Variable | Description |
| --- | --- |
| `SENTRY_DSN` | DSN string from Sentry. Leave blank to disable integration. |
| `SENTRY_ENV` | Overrides the environment label (defaults to `NODE_ENV`). |
| `SENTRY_TRACES_SAMPLE_RATE` | Fraction (`0`–`1`) of requests to sample for distributed tracing (defaults to `0`). |

When enabled, the Express app automatically wires the Sentry request/tracing handlers and sends exceptions through Sentry before responding with standardized JSON errors.
