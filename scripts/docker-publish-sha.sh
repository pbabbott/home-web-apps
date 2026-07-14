#!/usr/bin/env bash
# Local usage:
#   COMMIT_SHA=abc1234def5678 RUN_NUMBER=42 bash ./scripts/docker-publish-sha.sh
#   COMMIT_SHA=abc1234def5678 RUN_NUMBER=42 BASE_REF=main bash ./scripts/docker-publish-sha.sh
#   COMMIT_SHA=abc1234def5678 RUN_NUMBER=42 PACKAGE=blog bash ./scripts/docker-publish-sha.sh
#
# BASE_REF: branch name to compare against (e.g. "main"). Defaults to HEAD^1.
# Only packages with changes (or apps that depend on changed packages) are published.
# PACKAGE: publish only this package (e.g. "blog"), skipping the change
# filter — turbo resolves its own docker:publish:base dependency. Used by the
# CI docker-build matrix, where docker-publish-plan.sh already picked the
# changed set and each package publishes on its own runner pod. Omit to
# publish every changed package in one run (local use).
# DOCKER_PUBLISH_CONCURRENCY: max packages built in parallel when PACKAGE is
# unset (default 3). Each spawns its own `docker buildx build` + full
# monorepo `pnpm install`, so an unbounded turbo run can starve the runner
# (CPU/mem/disk).

set -euo pipefail
cd "$(dirname "$0")/.."

COMMIT_SHA="${COMMIT_SHA:?COMMIT_SHA is required}"
RUN_NUMBER="${RUN_NUMBER:?RUN_NUMBER is required}"
BASE_REF="${BASE_REF:-}"
PACKAGE="${PACKAGE:-}"
CONCURRENCY="${DOCKER_PUBLISH_CONCURRENCY:-3}"

SHORT_SHA="${COMMIT_SHA::7}"
PADDED_RUN=$(printf '%03d' "$RUN_NUMBER")
DATE=$(date +%Y%m%d)

export ABCTL_IMAGE_TAG="sha-${SHORT_SHA}"
export IMAGE_TAG="${DATE}-${PADDED_RUN}-${SHORT_SHA}"

echo "Publishing changed app images with Docker tag: ${ABCTL_IMAGE_TAG} (IMAGE_TAG: ${IMAGE_TAG})"

if [[ -n "$PACKAGE" ]]; then
  echo "Publishing package: ${PACKAGE}"
  pnpm turbo run docker:publish --filter="@abbottland/${PACKAGE}"
  exit 0
fi

if [[ -n "$BASE_REF" ]]; then
  git fetch --depth=1 --no-tags origin "$BASE_REF" 2>/dev/null || true
  TURBO_FILTER="origin/${BASE_REF}"
else
  TURBO_FILTER="HEAD^1"
fi

echo "Comparing against: ${TURBO_FILTER}"
# {./apps/*}[BASE]        — apps with direct file changes
# ...{./packages/*}[BASE] — changed packages + their dependent apps (fui-components/fui-icons → blog/diagram-maker, express/yaml-config → gluetun-sync/harbor-cleanup)
# turbo skips packages that have no docker:publish task
pnpm turbo run docker:publish \
  --concurrency="${CONCURRENCY}" \
  --filter="{./apps/*}[${TURBO_FILTER}]" \
  --filter="...{./packages/*}[${TURBO_FILTER}]"
