#!/usr/bin/env bash
# Local usage:
#   COMMIT_SHA=abc1234def5678 PR_NUMBER=42 bash ./scripts/docker-tag-pr.sh

set -euo pipefail
cd "$(dirname "$0")/.."

COMMIT_SHA="${COMMIT_SHA:?COMMIT_SHA is required}"
PR_NUMBER="${PR_NUMBER:?PR_NUMBER is required}"
IMAGE_REPO="${IMAGE_REPO:-harbor.local.abbottland.io/library/blog}"

SHORT_SHA="${COMMIT_SHA::7}"
SOURCE_TAG="${IMAGE_REPO}:sha-${SHORT_SHA}"
PR_TAG="${IMAGE_REPO}:pr-${PR_NUMBER}"

echo "Tagging ${SOURCE_TAG} → ${PR_TAG}"
docker pull "${SOURCE_TAG}"
docker tag "${SOURCE_TAG}" "${PR_TAG}"
docker push "${PR_TAG}"
