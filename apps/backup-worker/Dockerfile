ARG BASE_IMAGE
FROM ${BASE_IMAGE} AS builder

FROM node:22-alpine AS runner

# Reads files from the Windows source over SMB (packages/source-access).
# Installed here rather than in the shared runner stage so other apps'
# images stay small; same reason as homelab-api.
RUN apk add --no-cache samba-client

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nodejs

WORKDIR /app
COPY --from=builder --chown=nodejs:nodejs /app .
WORKDIR /app/apps/backup-worker

USER nodejs

ARG PORT=4004
ENV PORT=${PORT}
ENV NODE_ENV=production
EXPOSE ${PORT}

CMD ["node", "dist/index.js"]
