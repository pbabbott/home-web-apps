#!/usr/bin/env bash
# Local usage:
#   COMMIT_SHA=abc1234def5678 bash ./scripts/docker-publish-sha.sh

set -euo pipefail
cd "$(dirname "$0")/.."

COMMIT_SHA="${COMMIT_SHA:?COMMIT_SHA is required}"

SHORT_SHA="${COMMIT_SHA::7}"
export ABCTL_IMAGE_TAG="sha-${SHORT_SHA}"

echo "Publishing blog image with tag: ${ABCTL_IMAGE_TAG}"
pnpm turbo run docker:publish --filter=@abbottland/blog
