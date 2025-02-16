###############################################################
# Alpine base
###############################################################
ARG NODE_VERSION=18
FROM node:${NODE_VERSION}-alpine AS alpine
RUN apk update
RUN apk add --no-cache libc6-compat

###############################################################
# Setup pnpm and turbo on the alpine base
###############################################################
FROM alpine AS base
RUN npm install pnpm turbo --global
RUN pnpm config set store-dir ~/.pnpm-store

###############################################################
# Prune other projects from the monorepo
###############################################################
FROM base AS pruner
ARG PROJECT

WORKDIR /app
COPY . .
RUN turbo prune --scope=@abbottland/${PROJECT} --docker

###############################################################
# Build the project (suitable for development)
###############################################################
FROM base AS development
ARG PROJECT

WORKDIR /app

# Copy lockfile and package.json's of isolated subworkspace
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=pruner /app/out/json/ .

# First install the dependencies (as they change less often)
RUN --mount=type=cache,id=pnpm,target=~/.pnpm-store pnpm install --frozen-lockfile

# Copy source code of isolated subworkspace
COPY --from=pruner /app/out/full/ .

RUN turbo build --filter=@abbottland/${PROJECT} --log-prefix=none

CMD turbo dev --filter=@abbottland/${PROJECT} --log-prefix=none

###############################################################
# Prune npm packages and remove source code
###############################################################
FROM development AS builder

RUN --mount=type=cache,id=pnpm,target=~/.pnpm-store pnpm prune --prod --no-optional
RUN rm -rf ./**/*/src

###############################################################
# Final Image
###############################################################
FROM alpine AS runner
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