#!/usr/bin/env bash
# Local usage:
#   COMMIT_SHA=abc1234def5678 bash ./scripts/set-image-tag.sh
#
# Computes IMAGE_TAG=sha-<sha7> from COMMIT_SHA and writes it to
# $GITHUB_ENV (CI) or prints it (local). Matches the tag format
# used by docker-publish-sha.sh so the value baked into next build
# matches the pushed image tag.

set -euo pipefail
cd "$(dirname "$0")/.."

COMMIT_SHA="${COMMIT_SHA:?COMMIT_SHA is required}"

SHORT_SHA="${COMMIT_SHA::7}"
IMAGE_TAG="sha-${SHORT_SHA}"

echo "IMAGE_TAG=${IMAGE_TAG}"

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "IMAGE_TAG=${IMAGE_TAG}" >> "$GITHUB_ENV"
fi
