#!/bin/sh

## TODO: promote this to a proper script with typescript

PROJECT_DIR=$1
PROJECT=$2
DOCKERFILE=${3:-"../../docker/pnpm-turbo.Dockerfile"}
BASE_IMAGE=${4:-"harbor.local.abbottland.io/library/node-22-alpine:1.0.0"}

if [ -z "$PROJECT_DIR" ] || [ -z "$PROJECT" ]; then
  echo "Error: Both PROJECT_DIR and PROJECT must be provided."
  exit 1
fi

# Script runs in directory [PROJECT_DIR]/[PROJECT]
VERSION=$(node -p "require('./package.json').version")
IMAGE=harbor.local.abbottland.io/library/$PROJECT

docker build \
  -t $IMAGE:$VERSION \
  -f $DOCKERFILE \
  --build-arg PROJECT_DIR=$PROJECT_DIR \
  --build-arg PROJECT=$PROJECT \
  --build-arg BASE_IMAGE=$BASE_IMAGE \
  --progress=plain \
  ../../

# TODO: determine whether to use .docker/cache with turborepo
# Docker layer caching is pretty fast, but it's not as fast as turborepo's caching system
# DOCKER_BUILDKIT=1
# docker buildx build
# --builder mybuilder \
# --cache-from=type=local,src=.docker/cache \
# --cache-to=type=local,dest=.docker/cache \