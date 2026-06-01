#!/usr/bin/env bash
# Local usage:
#   COMMIT_SHA=abc1234def5678 RUN_NUMBER=42 bash ./scripts/docker-publish-sha.sh

set -euo pipefail
cd "$(dirname "$0")/.."

COMMIT_SHA="${COMMIT_SHA:?COMMIT_SHA is required}"
RUN_NUMBER="${RUN_NUMBER:?RUN_NUMBER is required}"

SHORT_SHA="${COMMIT_SHA::7}"
PADDED_RUN=$(printf '%03d' "$RUN_NUMBER")
DATE=$(date +%Y%m%d)

export ABCTL_IMAGE_TAG="sha-${SHORT_SHA}"
export IMAGE_TAG="${DATE}-${PADDED_RUN}-${SHORT_SHA}"

echo "Publishing app images with Docker tag: ${ABCTL_IMAGE_TAG} (IMAGE_TAG: ${IMAGE_TAG})"
pnpm turbo run docker:publish --filter='./apps/*' --filter='./packages/fui-components'
