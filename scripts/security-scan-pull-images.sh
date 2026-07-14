#!/usr/bin/env bash
# Local usage:
#   bash ./scripts/docker-login.sh
#   COMMIT_SHA=<sha> bash ./scripts/security-scan-pull-images.sh
#
# Pulls an image to scan for each of blog/diagram-maker/fui-components: the
# sha-tagged image docker-build published for this commit if it rebuilt the
# app, otherwise the most recently published image for that app — so an app
# that didn't change in this PR still gets scanned against what's actually
# shipping. Retags locally as security-scan/<app>:local. Requires
# `docker login` to Harbor first (docker-login.sh); the same login is reused
# to authenticate the Harbor tag-list lookup. Writes "<target> <tag>
# <current|latest>" per line to $SCANNED_TARGETS_FILE for
# security-scan-report.sh to consume.

set -euo pipefail
cd "$(dirname "$0")/.."

REGISTRY_HOST="${REGISTRY_HOST:-harbor.local.abbottland.io}"
# Not "REGISTRY" — ci.yml sets a workflow-level env var of that name, which
# would silently win over this default and drop the "/library" suffix.
HARBOR_REPO="${HARBOR_REPO:-${REGISTRY_HOST}/library}"
TAG_PREFIX="${TAG_PREFIX:-security-scan}"
COMMIT_SHA="${COMMIT_SHA:?COMMIT_SHA is required}"
SHORT_SHA="${COMMIT_SHA::7}"
SCANNED_TARGETS_FILE="${SCANNED_TARGETS_FILE:-/tmp/security-scan-targets.txt}"
DOCKER_CONFIG_FILE="${DOCKER_CONFIG_FILE:-$HOME/.docker/config.json}"

TARGETS=(blog diagram-maker fui-components)
: >"$SCANNED_TARGETS_FILE"

# Date-prefixed prod tags (YYYYMMDD-RRR-sha7, see set-image-tag.sh) sort
# lexicographically in chronological order, so the last one is the latest
# published build for that app.
latest_published_tag() {
  local target="$1"
  local auth
  auth=$(jq -r --arg host "$REGISTRY_HOST" '.auths[$host].auth // empty' "$DOCKER_CONFIG_FILE" 2>/dev/null || true)

  curl -sS -H "Authorization: Basic ${auth}" \
    "https://${REGISTRY_HOST}/v2/library/${target}/tags/list" |
    jq -r '.tags[]? | select(test("^[0-9]{8}-[0-9]+-[0-9a-f]+$"))' |
    sort |
    tail -1
}

for target in "${TARGETS[@]}"; do
  remote="${HARBOR_REPO}/${target}:sha-${SHORT_SHA}"
  local="${TAG_PREFIX}/${target}:local"

  echo "Checking for ${remote}..."
  if docker pull "$remote" >/dev/null 2>&1; then
    docker tag "$remote" "$local"
    echo "${target} sha-${SHORT_SHA} current" >>"$SCANNED_TARGETS_FILE"
    echo "Pulled ${remote} -> ${local}"
    continue
  fi

  echo "No image for this commit; looking up latest published tag for ${target}..."
  fallback_tag=$(latest_published_tag "$target")
  if [ -z "$fallback_tag" ]; then
    echo "No published image found for ${target} — skipping." >&2
    continue
  fi

  fallback_remote="${HARBOR_REPO}/${target}:${fallback_tag}"
  docker pull "$fallback_remote"
  docker tag "$fallback_remote" "$local"
  echo "${target} ${fallback_tag} latest" >>"$SCANNED_TARGETS_FILE"
  echo "Pulled ${fallback_remote} -> ${local}"
done
