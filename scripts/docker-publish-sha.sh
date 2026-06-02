#!/usr/bin/env bash
# Local usage:
#   COMMIT_SHA=abc1234def5678 RUN_NUMBER=42 bash ./scripts/docker-publish-sha.sh
#   COMMIT_SHA=abc1234def5678 RUN_NUMBER=42 BASE_REF=main bash ./scripts/docker-publish-sha.sh
#
# BASE_REF: branch name to compare against (e.g. "main"). Defaults to HEAD^1.
# Only packages with changes (or apps that depend on changed packages) are published.

set -euo pipefail
cd "$(dirname "$0")/.."

COMMIT_SHA="${COMMIT_SHA:?COMMIT_SHA is required}"
RUN_NUMBER="${RUN_NUMBER:?RUN_NUMBER is required}"
BASE_REF="${BASE_REF:-}"

SHORT_SHA="${COMMIT_SHA::7}"
PADDED_RUN=$(printf '%03d' "$RUN_NUMBER")
DATE=$(date +%Y%m%d)

export ABCTL_IMAGE_TAG="sha-${SHORT_SHA}"
export IMAGE_TAG="${DATE}-${PADDED_RUN}-${SHORT_SHA}"

if [[ -n "$BASE_REF" ]]; then
  git fetch --depth=1 --no-tags origin "$BASE_REF" 2>/dev/null || true
  TURBO_FILTER="origin/${BASE_REF}"
else
  TURBO_FILTER="HEAD^1"
fi

echo "Publishing changed app images with Docker tag: ${ABCTL_IMAGE_TAG} (IMAGE_TAG: ${IMAGE_TAG})"
echo "Comparing against: ${TURBO_FILTER}"
# {./apps/*}[BASE]        — apps with direct file changes
# ...{./packages/*}[BASE] — changed packages + their dependent apps (fui-components/fui-icons → blog/diagram-maker, express/yaml-config → gluetun-sync/harbor-cleanup)
# turbo skips packages that have no docker:publish task
pnpm turbo run docker:publish \
  --filter="{./apps/*}[${TURBO_FILTER}]" \
  --filter="...{./packages/*}[${TURBO_FILTER}]"
