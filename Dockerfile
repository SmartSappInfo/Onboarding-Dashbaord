# Container image for the SmartSapp app, built in CI rather than on App Hosting.
#
# WHY THIS EXISTS
# The identical `pnpm build` completes in ~4.5 minutes on a GitHub Actions runner
# (4 vCPU / 16 GB) and times out after 57m50s on App Hosting's Cloud Build machine
# (2 vCPU / 8 GB, not configurable). The app is not too large to build; that builder is too
# small, and once it starts swapping the build falls off a cliff. Building here removes the
# constraint instead of negotiating with it.
#
# CAUTION FOR FUTURE EDITORS
# `output: 'standalone'` ships only what Next traced as a module import. Anything the app
# reads from DISK at runtime must be copied in explicitly below, or it fails in production
# while building and passing tests perfectly well.

# ── deps ────────────────────────────────────────────────────────────────────
FROM node:22-slim AS deps
WORKDIR /app

# Native modules (canvas, sharp) need these to install.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ libc6-dev \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.7.0 --activate

# Copy only what affects dependency resolution, so this layer caches across code changes.
COPY package.json pnpm-lock.yaml .npmrc pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ── build ───────────────────────────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.7.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Opt into the standalone server. See the comment in next.config.ts.
ENV BUILD_STANDALONE=true
ENV NEXT_TELEMETRY_DISABLED=1
# Deliberately NOT capping BUILD_CPUS or RAYON_NUM_THREADS here: the whole point of
# building off App Hosting is to use the cores we actually have.
ENV NODE_OPTIONS=--max-old-space-size=6144

# NEXT_PUBLIC_* values are inlined at build time, so they must be present here, not just at
# runtime. Passed through as build args by the workflow.
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

RUN pnpm build

# ── runtime ─────────────────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Run as a non-root user. Cloud Run does not require it, but a container that cannot write
# to its own filesystem is a smaller target.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# The standalone server and its traced node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static assets are NOT included in standalone output and must be copied separately.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Served publicly, and read from disk by the extension download route.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Read at runtime by email-verifier; without it the blocklist silently degrades.
COPY --from=builder --chown=nextjs:nodejs /app/data ./data

USER nextjs

# Cloud Run injects PORT; default for local `docker run`.
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
