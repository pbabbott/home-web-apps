ARG BASE_IMAGE
FROM ${BASE_IMAGE} AS builder

FROM node:22-alpine AS runner
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nodejs

WORKDIR /app
COPY --from=builder --chown=nodejs:nodejs /app/apps/diagram-maker/.next/standalone ./
COPY --from=builder --chown=nodejs:nodejs /app/apps/diagram-maker/.next/static     ./apps/diagram-maker/.next/static
COPY --from=builder --chown=nodejs:nodejs /app/apps/diagram-maker/public           ./apps/diagram-maker/public

USER nodejs

ARG PORT=3000
ENV PORT=${PORT}
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production
EXPOSE ${PORT}

CMD ["node", "apps/diagram-maker/server.js"]
