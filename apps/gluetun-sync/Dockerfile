ARG BASE_IMAGE
FROM ${BASE_IMAGE} as installer

FROM node:18-alpine AS runner
WORKDIR /app

# Don't run production as root
RUN addgroup --system --gid 1001 expressjs
RUN adduser --system --uid 1001 expressjs
USER expressjs
COPY --from=installer /app .
CMD node apps/gluetun-sync/dist/index.js
