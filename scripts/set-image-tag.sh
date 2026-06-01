#!/usr/bin/env bash
# Local usage:
#   COMMIT_SHA=abc1234def5678 RUN_NUMBER=42 bash ./scripts/set-image-tag.sh
#
# Computes IMAGE_TAG=<YYYYMMDD>-<RRR>-<sha7> and writes it to
# $GITHUB_ENV (CI) or prints it (local). Run number is zero-padded to
# 3 digits. Matches the format used by docker-publish-sha.sh so the
# value baked into next build matches the pushed image tag.

set -euo pipefail
cd "$(dirname "$0")/.."

COMMIT_SHA="${COMMIT_SHA:?COMMIT_SHA is required}"
RUN_NUMBER="${RUN_NUMBER:?RUN_NUMBER is required}"

SHORT_SHA="${COMMIT_SHA::7}"
PADDED_RUN=$(printf '%03d' "$RUN_NUMBER")
DATE=$(date +%Y%m%d)
IMAGE_TAG="${DATE}-${PADDED_RUN}-${SHORT_SHA}"

echo "IMAGE_TAG=${IMAGE_TAG}"

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "IMAGE_TAG=${IMAGE_TAG}" >> "$GITHUB_ENV"
fi
