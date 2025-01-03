#!/bin/sh

docker build \
  -t harbor.local.abbottland.io/library/gluetun-sync \
  -f ../../docker/medium.Dockerfile \
  --build-arg PROJECT=gluetun-sync \
  --progress=plain \
  ../../

# TODO: determine if i want to use .docker/cache with turborepo
# DOCKER_BUILDKIT=1
# docker buildx build
# --builder mybuilder \
# --cache-from=type=local,src=.docker/cache \
# --cache-to=type=local,dest=.docker/cache \