# syntax=docker/dockerfile:1
#
# neoceg-api — serve mode (CLI spec §7). A small Node container that runs the
# NeoCEG CLI's HTTP API (`neoceg serve`). It reuses the same core the batch CLI
# uses and adds no runtime dependency beyond the Node standard library plus tsx
# (which runs the TypeScript sources directly, exactly as bin/neoceg.mjs does).
#
# Co-located behind the shared reverse proxy at /neoceg, like the sibling
# demo APIs (/nswitch, /pict). Public, no auth — protected by the in-process
# guardrails (§7.6), not by an identity gate.

FROM node:20-alpine

WORKDIR /app

# Install dependencies first for layer caching. tsx is a devDependency, so a
# full install is required (serve mode runs the .ts sources via tsx).
COPY package.json package-lock.json ./
RUN npm ci

# Application sources. .dockerignore keeps node_modules / dist / tests out.
COPY . .

# Non-root (the base image ships an unprivileged `node` user).
USER node

# Same-origin deploys terminate CORS at the proxy; default the allow-origin to
# the GUI origin at run time via NEOCEG_ALLOWED_ORIGIN (§7.6). Bind all
# interfaces so the proxy can reach the container.
ENV NEOCEG_ALLOWED_ORIGIN=*
EXPOSE 8091

# PORT (if injected by the host) overrides --port; see resolveServeConfig (§7.6).
CMD ["node", "--import", "tsx", "src/cli.ts", "serve", "--host", "0.0.0.0", "--port", "8091"]
