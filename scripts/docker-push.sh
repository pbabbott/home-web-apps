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

docker push $IMAGE:$VERSION

# Tag the image with latest
docker tag $IMAGE:$VERSION $IMAGE:latest

# Push the latest tag
docker push $IMAGE:latest