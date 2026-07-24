ARG BASE_IMAGE
FROM ${BASE_IMAGE} AS builder

FROM node:22-alpine AS runner

# npm's own bundled deps (not app deps) trip vulnerability scans; the
# runtime never calls npm/npx, only `node`, so drop them.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nodejs

WORKDIR /app
COPY --from=builder --chown=nodejs:nodejs /app/apps/home-hud/.next/standalone ./
COPY --from=builder --chown=nodejs:nodejs /app/apps/home-hud/.next/static     ./apps/home-hud/.next/static

USER nodejs

ARG PORT=3000
ENV PORT=${PORT}
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production
EXPOSE ${PORT}

CMD ["node", "apps/home-hud/server.js"]
