ARG BASE_IMAGE
FROM ${BASE_IMAGE} as tools

ARG APP_NAME

###############################################################
# builder stage
###############################################################
FROM tools AS builder
WORKDIR /app
COPY . .

# Running this command creates a pruned version of your monorepo inside an ./out directory. 
# It only includes workspaces which api depends on. 
# It also prunes the lockfile so that only the relevant node_modules will be downloaded.
RUN turbo prune ${APP_NAME} --docker

###############################################################
# installer stage
###############################################################

FROM tools AS installer
WORKDIR /app

# Add lockfile and package.json's of isolated subworkspace
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# First install dependencies (as they change less often)
RUN pnpm install

# Build the project and its dependencies
COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json

RUN turbo build --filter=${APP_NAME}