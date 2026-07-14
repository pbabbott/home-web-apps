#!/usr/bin/env bash
# Local usage:
#   bash ./scripts/docker-publish-plan.sh
#   BASE_REF=main bash ./scripts/docker-publish-plan.sh
#
# Prints a JSON array of package names (e.g. ["blog","fui-components"]) that
# have a docker:publish task and changed relative to BASE_REF (or HEAD^1).
# Feeds the docker-build matrix in CI so each package builds on its own
# runner pod instead of piling every image onto one disk-limited pod.
#
# BASE_REF: branch name to compare against (e.g. "main"). Defaults to HEAD^1.

set -euo pipefail
cd "$(dirname "$0")/.."

BASE_REF="${BASE_REF:-}"

if [[ -n "$BASE_REF" ]]; then
  git fetch --depth=1 --no-tags origin "$BASE_REF" 2>/dev/null || true
  TURBO_FILTER="origin/${BASE_REF}"
else
  TURBO_FILTER="HEAD^1"
fi

# {./apps/*}[BASE]        — apps with direct file changes
# ...{./packages/*}[BASE] — changed packages + their dependent apps (fui-components/fui-icons → blog/diagram-maker, express/yaml-config → gluetun-sync/harbor-cleanup)
# --dry-run=json lists every package turbo *considered*, including ones with
# no docker:publish script (command "<NONEXISTENT>") — filter those out.
pnpm turbo run docker:publish \
  --filter="{./apps/*}[${TURBO_FILTER}]" \
  --filter="...{./packages/*}[${TURBO_FILTER}]" \
  --dry-run=json 2>/dev/null |
  jq -c '[.tasks[] | select(.task == "docker:publish" and .command != "<NONEXISTENT>") | .package | sub("^@abbottland/"; "")] | unique'
