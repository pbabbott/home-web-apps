#!/usr/bin/env bash
# Local usage:
#   bash ./scripts/docker-login.sh
#   COMMIT_SHA=<sha-published-by-docker-build> bash ./scripts/security-scan-pull-images.sh
#
# Pulls the sha-tagged blog/diagram-maker/fui-components images that the
# docker-build job already published to Harbor for this commit, and retags
# them locally as security-scan/<app>:local for Trivy to scan. Only apps
# that changed (and were therefore rebuilt/published) have a fresh sha-tag;
# unchanged apps are skipped here since they were already scanned in the PR
# that last touched them. Writes the list of pulled targets to
# $SCANNED_TARGETS_FILE for security-scan-report.sh to consume.

set -euo pipefail
cd "$(dirname "$0")/.."

REGISTRY="${REGISTRY:-harbor.local.abbottland.io/library}"
TAG_PREFIX="${TAG_PREFIX:-security-scan}"
COMMIT_SHA="${COMMIT_SHA:?COMMIT_SHA is required}"
SHORT_SHA="${COMMIT_SHA::7}"
SCANNED_TARGETS_FILE="${SCANNED_TARGETS_FILE:-/tmp/security-scan-targets.txt}"

TARGETS=(blog diagram-maker fui-components)
: >"$SCANNED_TARGETS_FILE"

for target in "${TARGETS[@]}"; do
  remote="${REGISTRY}/${target}:sha-${SHORT_SHA}"
  local="${TAG_PREFIX}/${target}:local"

  echo "Checking for ${remote}..."
  if docker pull "$remote" >/dev/null 2>&1; then
    docker tag "$remote" "$local"
    echo "$target" >>"$SCANNED_TARGETS_FILE"
    echo "Pulled ${remote} -> ${local}"
  else
    echo "No ${remote} published for this commit (unchanged in this PR) — skipping."
  fi
done
