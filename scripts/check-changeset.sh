#!/usr/bin/env bash

# Local usage:
#   bash ./scripts/check-changeset.sh
#
# Override base ref (default: main):
#   BASE_REF=develop bash ./scripts/check-changeset.sh
#
# CI passes BASE_REF explicitly:
#   BASE_REF=${{ github.base_ref }} bash ./scripts/check-changeset.sh

set -euo pipefail

cd "$(dirname "$0")/.."

BASE_REF="${BASE_REF:-main}"
BASE="origin/${BASE_REF}"

echo "Checking changeset requirement against ${BASE}..."
echo ""

# ── Resolve changed files ─────────────────────────────────────────────────────
if ! git rev-parse "${BASE}" > /dev/null 2>&1; then
    echo "Warning: '${BASE}' not found — trying '${BASE_REF}' directly."
    BASE="${BASE_REF}"
fi

CHANGED=$(git diff --name-only "${BASE}...HEAD")

# ── Check for apps/ or packages/ changes ─────────────────────────────────────
APP_OR_PKG=$(echo "$CHANGED" | grep -E '^(apps|packages)/' || true)

if [ -z "$APP_OR_PKG" ]; then
    echo "No changes in apps/ or packages/ — changeset not required."
    exit 0
fi

echo "Changes detected in apps/ or packages/:"
echo "$APP_OR_PKG"
echo ""

# ── Check for new changeset file ─────────────────────────────────────────────
NEW_CHANGESETS=$(git diff --name-only --diff-filter=A "${BASE}...HEAD" \
    | grep -E '^\.changeset/.+\.md$' \
    | grep -v 'README' \
    || true)

if [ -z "$NEW_CHANGESETS" ]; then
    echo "ERROR: apps/ or packages/ changed but no changeset found."
    echo "Run 'pnpm changeset' to create one."
    exit 1
fi

echo "Changeset found:"
echo "$NEW_CHANGESETS"
