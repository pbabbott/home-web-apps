#!/usr/bin/env bash
# Local usage:
#   bash ./scripts/unit-test-plan.sh
#
# Prints a JSON array of package names (e.g. ["video-api","video-db"]) that
# have a test:unit task. Feeds the unit-tests matrix in CI so each package's
# unit tests run on their own runner pod instead of piling onto one shared
# pod.

set -euo pipefail
cd "$(dirname "$0")/.."

pnpm turbo run test:unit --dry-run=json 2>/dev/null |
  jq -c '[.tasks[] | select(.task == "test:unit" and .command != "<NONEXISTENT>") | .package | sub("^@abbottland/"; "")] | unique'
