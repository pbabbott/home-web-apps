FROM nginx:alpine
# COPY before the apk upgrade so this layer's cache key changes on every
# build (storybook-static's content hash differs each time) — otherwise the
# registry build cache serves a stale apk upgrade indefinitely, since
# nothing else in this Dockerfile varies between builds.
COPY ./storybook-static /usr/share/nginx/html
RUN apk update && apk upgrade --no-cache