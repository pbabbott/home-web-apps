#!/usr/bin/env bash
# Local usage:
#   bash ./scripts/integration-test-plan.sh
#
# Prints a JSON array of package names (e.g. ["video-api","video-worker"])
# that have a test:int task. Feeds the integration-tests matrix in CI so each
# package's integration tests (and any docker-compose dev deps they spin up)
# run on their own runner pod — running video-api and video-worker's Postgres
# containers in the same job raced for host port 5432.

set -euo pipefail
cd "$(dirname "$0")/.."

pnpm turbo run test:int --dry-run=json 2>/dev/null |
  jq -c '[.tasks[] | select(.task == "test:int" and .command != "<NONEXISTENT>") | .package | sub("^@abbottland/"; "")] | unique'
