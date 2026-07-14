#!/usr/bin/env bash
# Local usage:
#   IMAGE=harbor.local.abbottland.io/library/blog:sha-abc1234 bash ./scripts/check-remote-image.sh
#
# Checks whether IMAGE exists in the registry. Prints "true" or "false" on
# stdout (status/progress goes to stderr, so stdout is safe to capture) and,
# when running in CI, also writes exists=<bool> to $GITHUB_OUTPUT.

set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE="${IMAGE:?IMAGE is required}"

echo "Fetching Harbor credentials from 1Password..." >&2
HARBOR_JSON=$(op item get "harbor.local.abbottland.io - admin" --format=json --vault=Homelab)
HARBOR_USER=$(echo "$HARBOR_JSON" | jq -r '.fields[] | select(.id=="username") | .value')
HARBOR_PASS=$(echo "$HARBOR_JSON" | jq -r '.fields[] | select(.id=="password") | .value')

REGISTRY_HOST="${IMAGE%%/*}"
REPO_AND_TAG="${IMAGE#*/}"
REPO_NAME="${REPO_AND_TAG%:*}"
IMAGE_TAG="${REPO_AND_TAG##*:}"

echo "Checking image exists: ${IMAGE}..." >&2
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Accept: application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.oci.image.index.v1+json" \
  -u "${HARBOR_USER}:${HARBOR_PASS}" \
  "https://${REGISTRY_HOST}/v2/${REPO_NAME}/manifests/${IMAGE_TAG}")

if [ "$HTTP_STATUS" = "200" ]; then
  echo "  OK — image found." >&2
  EXISTS=true
else
  echo "  Not found (HTTP ${HTTP_STATUS})." >&2
  EXISTS=false
fi

echo "$EXISTS"

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "exists=${EXISTS}" >>"$GITHUB_OUTPUT"
fi
