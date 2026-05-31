#!/usr/bin/env bash

# Local usage (only PR_NUMBER required):
#   PR_NUMBER=42 bash ./scripts/deploy-preview.sh
#
# CI passes additional vars to be explicit:
#   PR_NUMBER=42 HEAD_SHA=<full-sha> IMAGE=<repo>:pr-42-<sha7> bash ./scripts/deploy-preview.sh

set -euo pipefail

cd "$(dirname "$0")/.."

# ── Resolve inputs ────────────────────────────────────────────────────────────
IMAGE_REPO="${IMAGE_REPO:-harbor.local.abbottland.io/library/blog}"

HEAD_SHA_SOURCE="env"
if [ -z "${HEAD_SHA:-}" ]; then
    HEAD_SHA=$(git rev-parse HEAD)
    HEAD_SHA_SOURCE="git"
fi
SHORT_SHA="${HEAD_SHA::7}"

IMAGE_SOURCE="env"
if [ -z "${IMAGE:-}" ]; then
    IMAGE="${IMAGE_REPO}:pr-${PR_NUMBER:-}-${SHORT_SHA}"
    IMAGE_SOURCE="derived"
fi

# ── Validate + print config ───────────────────────────────────────────────────
MISSING=0

if [ -z "${PR_NUMBER:-}" ]; then
    echo "  MISSING  PR_NUMBER   (required — no way to auto-derive)"
    MISSING=1
else
    echo "  OK       PR_NUMBER   = ${PR_NUMBER}"
fi

echo "  OK       HEAD_SHA    = ${HEAD_SHA}  (${HEAD_SHA_SOURCE})"
echo "  OK       IMAGE       = ${IMAGE}  (${IMAGE_SOURCE})"
echo "  OK       IMAGE_REPO  = ${IMAGE_REPO}"

if [ "${MISSING}" -ne 0 ]; then
    echo ""
    echo "Error: missing required variables above. Aborting."
    exit 1
fi

echo ""
echo "Deploying preview for PR #${PR_NUMBER}..."

# ── Kubeconfig ────────────────────────────────────────────────────────────────
if [ -z "${KUBECONFIG:-}" ] || [ ! -f "${KUBECONFIG}" ]; then
    echo "Fetching kubeconfig from 1Password..."
    KUBECONFIG_TMP=$(mktemp)
    op read "op://Homelab/Kubeconfig Admin/kubeconfig" > "$KUBECONFIG_TMP"
    chmod 600 "$KUBECONFIG_TMP"
    export KUBECONFIG="$KUBECONFIG_TMP"
fi

kubectl config use-context prod-gen2

# ── Harbor credentials ────────────────────────────────────────────────────────
echo "Fetching Harbor credentials from 1Password..."
HARBOR_JSON=$(op item get "harbor.local.abbottland.io - admin" --format=json --vault=Homelab)
HARBOR_USER=$(echo "$HARBOR_JSON" | jq -r '.fields[] | select(.id=="username") | .value')
HARBOR_PASS=$(echo "$HARBOR_JSON" | jq -r '.fields[] | select(.id=="password") | .value')

# ── Verify image exists in registry ──────────────────────────────────────────
REGISTRY_HOST="${IMAGE%%/*}"
REPO_AND_TAG="${IMAGE#*/}"
REPO_NAME="${REPO_AND_TAG%:*}"
IMAGE_TAG="${REPO_AND_TAG##*:}"
echo "Checking image exists: ${IMAGE}..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -u "${HARBOR_USER}:${HARBOR_PASS}" \
    "https://${REGISTRY_HOST}/v2/${REPO_NAME}/manifests/${IMAGE_TAG}")
if [ "$HTTP_STATUS" != "200" ]; then
    echo ""
    echo "Error: image not found in registry (HTTP ${HTTP_STATUS})."
    echo "  ${IMAGE}"
    echo ""
    echo "CI 'Tag PR image' step may not have run yet."
    echo "Either wait for CI or push manually:"
    echo "  COMMIT_SHA=${HEAD_SHA} PR_NUMBER=${PR_NUMBER} bash ./scripts/docker-tag-pr.sh"
    exit 1
fi
echo "  OK — image found."


# ── Namespace + imagePullSecret ───────────────────────────────────────────────
kubectl create namespace "pr-${PR_NUMBER}" \
    --dry-run=client -o yaml | kubectl apply -f -
kubectl label namespace "pr-${PR_NUMBER}" \
    ephemeral=true \
    "pr-number=${PR_NUMBER}" \
    app.kubernetes.io/managed-by=github-actions \
    --overwrite

kubectl create secret docker-registry regcred \
    --docker-server=harbor.local.abbottland.io \
    --docker-username="$HARBOR_USER" \
    --docker-password="$HARBOR_PASS" \
    -n "pr-${PR_NUMBER}" \
    --dry-run=client -o yaml | kubectl apply -f -

# ── Apply manifests ───────────────────────────────────────────────────────────
export PR_NUMBER IMAGE IMAGE_TAG
awk 'FNR==1 && NR>1{print "---"}1' \
    apps/blog/k8s/pr-preview/namespace.yaml \
    apps/blog/k8s/pr-preview/deployment.yaml \
    apps/blog/k8s/pr-preview/service.yaml \
    apps/blog/k8s/pr-preview/httproute.yaml \
    | envsubst '${PR_NUMBER} ${IMAGE} ${IMAGE_TAG}' \
    | kubectl apply -f -

# ── Wait for rollout ──────────────────────────────────────────────────────────
kubectl rollout status deployment/blog \
    -n "pr-${PR_NUMBER}" --timeout=180s

# ── Wait for DNS ──────────────────────────────────────────────────────────────
HOST="pr-${PR_NUMBER}-blog.local.abbottland.io"
echo "Polling DNS for $HOST..."
for i in $(seq 1 18); do
    if getent hosts "$HOST" > /dev/null 2>&1; then
        echo "DNS resolved: $(getent hosts "$HOST")"
        break
    fi
    echo "Attempt $i/18 — not resolved, sleeping 10s..."
    sleep 10
done
if ! getent hosts "$HOST" > /dev/null 2>&1; then
    echo "Warning: DNS did not resolve within 3 minutes. Preview may not be reachable yet."
fi

echo ""
echo "Preview URL: https://${HOST}"
echo "Image: ${IMAGE}"
