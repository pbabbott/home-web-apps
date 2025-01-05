#!/bin/sh

PROJECT_DIR=$1
PROJECT=$2

if [ -z "$PROJECT_DIR" ] || [ -z "$PROJECT" ]; then
  echo "Error: Both PROJECT_DIR and PROJECT must be provided."
  exit 1
fi
# Script runs in directory [PROJECT_DIR]/[PROJECT]
VERSION=$(node -p "require('./package.json').version")
IMAGE=harbor.local.abbottland.io/library/$PROJECT

docker build \
  -t $IMAGE:$VERSION \
  -f ../../docker/medium.Dockerfile \
  --build-arg PROJECT_DIR=$PROJECT_DIR \
  --build-arg PROJECT=$PROJECT \
  --progress=plain \
  ../../

# TODO: determine whether i want to use .docker/cache with turborepo
# Docker layer caching is pretty fast, but it's not as fast as turborepo
# DOCKER_BUILDKIT=1
# docker buildx build
# --builder mybuilder \
# --cache-from=type=local,src=.docker/cache \
# --cache-to=type=local,dest=.docker/cache \