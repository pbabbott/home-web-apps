ARG BASE_IMAGE
FROM ${BASE_IMAGE} AS builder

FROM node:22-alpine AS runner

# ffmpeg (ffprobe) is the only thing video-api needs beyond the shared
# Node.js runner image, for GET /run-time and POST /title-cards. Most other
# apps build off docker/pnpm-turbo.Dockerfile's runner stage directly, but
# that stage is shared, so ffmpeg is installed here instead of bloating
# every other app's image (see also video-worker's Dockerfile).
RUN apk update && apk add --no-cache ffmpeg

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nodejs

WORKDIR /app
COPY --from=builder --chown=nodejs:nodejs /app .
WORKDIR /app/apps/video-api

USER nodejs

ARG PORT=4002
ENV PORT=${PORT}
ENV NODE_ENV=production
EXPOSE ${PORT}

CMD ["node", "dist/index.js"]
