ARG BASE_IMAGE
FROM ${BASE_IMAGE} AS builder

FROM node:22-alpine AS runner

# Reads files from Windows sources for exodus file preview (src/lib/connections/smb.ts).
RUN apk add --no-cache samba-client

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nodejs

WORKDIR /app
COPY --from=builder --chown=nodejs:nodejs /app .
WORKDIR /app/apps/homelab-api

USER nodejs

ARG PORT=4003
ENV PORT=${PORT}
ENV NODE_ENV=production
EXPOSE ${PORT}

CMD ["node", "dist/index.js"]
