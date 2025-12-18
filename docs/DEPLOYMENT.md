# Deployment Guide

This project ships with container and host-based deployment recipes.

## Docker Image

The root `Dockerfile` builds a non-root Node.js image using multi-stage installation:

```sh
docker build -t uaw1284-membership .
docker run -p 3000:3000 --env-file .env.production uaw1284-membership
```

Key details:

- `NODE_ENV=production`, `PORT=3000`, and `TZ=UTC` default inside the container.
- App runs as the `nodeapp` user (non-root).
- Copy your `.env.production` file (or set environment variables through your orchestrator).

Use the accompanying `.dockerignore` to keep builds slim—local modules, git metadata, and logs are excluded automatically.

## Reverse Proxy (Nginx)

`deploy/nginx.conf` illustrates how to forward traffic from port 80 to the containerized app:

- Sets the standard `X-Forwarded-*` headers required for `trust proxy`.
- Proxies `/api/health/live` and `/api/health/ready` directly.
- Uncomment the HTTPS redirect if TLS terminates at Nginx. Otherwise run Nginx with valid certificates (e.g., via Let’s Encrypt).
- Enables gzip for CSS/JS/JSON payloads. Enable Brotli if your platform supports it.

Example Docker Compose snippet:

```yaml
services:
  app:
    image: uaw1284-membership
    env_file: .env.production
  nginx:
    image: nginx:1.27
    ports:
      - "80:80"
    volumes:
      - ./deploy/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - app
```

## PM2 / systemd (Non-container)

If deploying on bare metal or a VM:

1. Install production dependencies (`npm ci --omit=dev`).
2. Run database migrations (`npm run migrate`).
3. Launch with PM2:
   ```sh
   npx pm2 start server/index.js --name uaw1284-membership
   ```
4. Configure systemd or PM2 startup scripts to restart on boot.

Systemd template (drop in `/etc/systemd/system/uaw1284-membership.service`):

```
[Unit]
Description=UAW 1284 Membership Server
After=network.target

[Service]
Environment=NODE_ENV=production
WorkingDirectory=/opt/uaw1284-mbr-srv
ExecStart=/usr/bin/node server/index.js
Restart=always
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

Enable via `sudo systemctl enable --now uaw1284-membership`.

Choose the deployment path that fits your infrastructure, but keep log shipping, health checks, and metrics wired up per the monitoring guide.
