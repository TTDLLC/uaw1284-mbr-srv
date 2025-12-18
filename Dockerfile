# syntax=docker/dockerfile:1.6
FROM node:22-slim AS base

WORKDIR /app

# Install dependencies separately to maximize cache usage
FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends build-essential python3 && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci

FROM base AS production-deps
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS app
ENV NODE_ENV=production
ENV PORT=3000
ENV TZ=UTC

# Create non-root user
RUN useradd --user-group --create-home --shell /bin/bash nodeapp
WORKDIR /app

COPY --from=production-deps /app/node_modules ./node_modules
COPY package*.json ./
COPY server ./server
COPY client ./client
COPY docs ./docs
COPY scripts ./scripts
COPY .env.example ./ .env.example

RUN chown -R nodeapp:nodeapp /app
USER nodeapp

EXPOSE 3000

CMD ["node", "server/index.js"]
