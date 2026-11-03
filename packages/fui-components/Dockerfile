FROM nginx:alpine
# COPY before the apk upgrade so this layer's cache key changes on every
# build (storybook-static's content hash differs each time) — otherwise the
# registry build cache serves a stale apk upgrade indefinitely, since
# nothing else in this Dockerfile varies between builds. The upgrade pulls
# base-image security fixes (for example libexpat 2.10.0), so an image published
# before a fix reaches the Alpine repositories stays vulnerable until rebuilt.
COPY ./storybook-static /usr/share/nginx/html
# Naming libexpat changes this layer's command, so a build cached from before
# its fix (2.10.0) cannot be reused; the full upgrade still covers the rest.
RUN apk update && apk upgrade --no-cache libexpat && apk upgrade --no-cache
