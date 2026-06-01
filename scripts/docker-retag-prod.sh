#!/usr/bin/env bash
# Local usage:
#   COMMIT_SHA=<merge-commit-sha> RUN_NUMBER=42 bash ./scripts/docker-retag-prod.sh
#
# Finds the PR branch head SHA from the merge commit's second parent,
# then retags the existing sha-<sha7> image with a production tag.
# Falls back to COMMIT_SHA directly for squash/direct-push merges.

set -euo pipefail
cd "$(dirname "$0")/.."

COMMIT_SHA="${COMMIT_SHA:?COMMIT_SHA is required}"
RUN_NUMBER="${RUN_NUMBER:?RUN_NUMBER is required}"
IMAGE_REPO="${IMAGE_REPO:-harbor.local.abbottland.io/library/blog}"

PARENTS=$(git log --pretty=%P -1 "$COMMIT_SHA")
PARENT_COUNT=$(echo "$PARENTS" | wc -w)

if [ "$PARENT_COUNT" -ge 2 ]; then
  SOURCE_SHA=$(echo "$PARENTS" | awk '{print $2}')
  echo "Merge commit detected; using PR branch head: ${SOURCE_SHA::7}"
else
  SOURCE_SHA="$COMMIT_SHA"
  echo "No merge parent found; using commit directly: ${SOURCE_SHA::7}"
fi

SHORT_SHA="${SOURCE_SHA::7}"
DATE=$(date +%Y%m%d)
PROD_TAG="${DATE}-${RUN_NUMBER}-${SHORT_SHA}"

echo "Retagging ${IMAGE_REPO}:sha-${SHORT_SHA} → ${IMAGE_REPO}:${PROD_TAG}"
docker buildx imagetools create \
  --tag "${IMAGE_REPO}:${PROD_TAG}" \
  "${IMAGE_REPO}:sha-${SHORT_SHA}"
