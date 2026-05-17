ARG BASE_IMAGE
FROM ${BASE_IMAGE} AS builder

FROM node:22-alpine AS runner
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nodejs

WORKDIR /app
COPY --from=builder --chown=nodejs:nodejs /app/apps/blog/.next/standalone ./
COPY --from=builder --chown=nodejs:nodejs /app/apps/blog/.next/static     ./apps/blog/.next/static
COPY --from=builder --chown=nodejs:nodejs /app/apps/blog/public           ./apps/blog/public

USER nodejs

ARG PORT=3000
ENV PORT=${PORT}
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production
EXPOSE ${PORT}

CMD ["node", "apps/blog/server.js"]
