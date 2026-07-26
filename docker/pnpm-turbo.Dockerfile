###############################################################
# Setup pnpm and turbo on the alpine base
###############################################################
ARG BASE_IMAGE
FROM ${BASE_IMAGE} AS base
RUN npm install pnpm@10.15.0 turbo --global
RUN pnpm config set store-dir /root/.pnpm-store

###############################################################
# Prune other projects from the monorepo
###############################################################
FROM base AS pruner
ARG PROJECT

WORKDIR /app
COPY . .

RUN turbo prune --scope=@abbottland/${PROJECT} --docker

###############################################################
# Install packages
###############################################################
FROM base AS npm
ARG PROJECT
ENV PROJECT=${PROJECT}
WORKDIR /app

# Copy lockfile and package.json's of isolated subworkspace
COPY --from=pruner /app/out/json/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/json/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=pruner /app/out/json/ .

# First install the dependencies (as they change less often)
RUN --mount=type=cache,id=pnpm,target=/root/.pnpm-store,sharing=locked pnpm install --frozen-lockfile

###############################################################
# Build the project (suitable for development)
###############################################################
FROM npm AS development

ARG IMAGE_TAG=""
ENV IMAGE_TAG=${IMAGE_TAG}

# Turbo remote cache auth. TURBO_TOKEN is mounted as a build secret (never
# baked into a layer); API/TEAM aren't sensitive so they travel as build args.
ARG TURBO_API=""
ARG TURBO_TEAM=""
ENV TURBO_API=${TURBO_API}
ENV TURBO_TEAM=${TURBO_TEAM}

# Copy source code of isolated subworkspace
COPY --from=pruner /app/out/full .
RUN --mount=type=secret,id=turbo_token \
  TURBO_TOKEN="$(cat /run/secrets/turbo_token 2>/dev/null || true)" \
  turbo build --filter=@abbottland/${PROJECT} --log-prefix=none
CMD turbo dev --filter=@abbottland/${PROJECT} --log-prefix=none

###############################################################
# Prune npm packages and remove source code
###############################################################
FROM development AS builder

# `pnpm prune --prod` leaves node_modules in a state where some direct
# deps (e.g. gluetun-sync's reflect-metadata) resolve in the pnpm store but
# aren't symlinked into the consuming package's node_modules -- a runtime
# MODULE_NOT_FOUND that only shows up when the container actually starts.
# A fresh --prod install always re-links from scratch, so wipe node_modules
# and reinstall instead of pruning in place. --ignore-scripts skips husky's
# `prepare` hook, which fails because husky itself is a devDependency no
# longer present.
RUN rm -rf node_modules apps/*/node_modules packages/*/node_modules
RUN --mount=type=cache,id=pnpm,target=/root/.pnpm-store,sharing=locked pnpm install --prod --frozen-lockfile --ignore-scripts
RUN rm -rf apps/*/src packages/*/src

###############################################################
# Final Image
###############################################################
FROM node:26-alpine AS runner
ARG PROJECT
ARG PROJECT_DIR

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs
USER nodejs

WORKDIR /app
COPY --from=builder --chown=nodejs:nodejs /app .
WORKDIR /app/${PROJECT_DIR}/${PROJECT}

ARG PORT=8080
ENV PORT=${PORT}
ENV NODE_ENV=production
EXPOSE ${PORT}

CMD node dist/index