#!/usr/bin/env bash
# Local usage:
#   bash ./scripts/pnpm-install-ci.sh
#
# Installs with --frozen-lockfile --offline (fast path, hits the shared
# NAS-mounted pnpm store). Falls back to a normal frozen install when the
# store is missing a package -- e.g. right after a dependency bump
# introduces a version no runner has fetched yet -- which both unblocks
# this run and warms the shared store for every job after it.

set -euo pipefail
cd "$(dirname "$0")/.."

pnpm install --frozen-lockfile --offline || pnpm install --frozen-lockfile
