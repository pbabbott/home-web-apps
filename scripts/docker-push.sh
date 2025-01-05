#!/bin/sh

set -e

PROJECT_DIR=$1
PROJECT=$2

if [ -z "$PROJECT_DIR" ] || [ -z "$PROJECT" ]; then
  echo "Error: Both PROJECT_DIR and PROJECT must be provided."
  exit 1
fi
# Script runs in directory [PROJECT_DIR]/[PROJECT]
VERSION=$(node -p "require('./package.json').version")
IMAGE=harbor.local.abbottland.io/library/$PROJECT

# Check if the image with the specific version already exists in the remote registry
if docker manifest inspect $IMAGE:$VERSION > /dev/null 2>&1; then
  echo "⚠️  Image $IMAGE:$VERSION already exists in the remote registry. (Skipping push process)"
  exit 0
fi


docker push $IMAGE:$VERSION

# Tag the image with latest
docker tag $IMAGE:$VERSION $IMAGE:latest

# Push the latest tag
docker push $IMAGE:latest