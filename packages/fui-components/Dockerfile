ARG BASE_IMAGE
FROM ${BASE_IMAGE} AS base

FROM nginx:alpine
COPY --from=base /app/packages/fui-components/storybook-static /usr/share/nginx/html
