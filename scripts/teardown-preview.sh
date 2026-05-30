#!/usr/bin/env bash

# Local usage (only PR_NUMBER required):
#   PR_NUMBER=42 bash ./scripts/teardown-preview.sh

set -euo pipefail

cd "$(dirname "$0")/.."

# ── Resolve inputs ────────────────────────────────────────────────────────────
KUBECONFIG_ITEM="${KUBECONFIG_ITEM:-op://Homelab/Kubeconfig Admin/kubeconfig}"
KUBE_CONTEXT="${KUBE_CONTEXT:-prod-gen2}"

# ── Validate + print config ───────────────────────────────────────────────────
MISSING=0

if [ -z "${PR_NUMBER:-}" ]; then
    echo "  MISSING  PR_NUMBER       (required — no way to auto-derive)"
    MISSING=1
else
    echo "  OK       PR_NUMBER       = ${PR_NUMBER}"
fi

echo "  OK       KUBECONFIG_ITEM = ${KUBECONFIG_ITEM}"
echo "  OK       KUBE_CONTEXT    = ${KUBE_CONTEXT}"

if [ "${MISSING}" -ne 0 ]; then
    echo ""
    echo "Error: missing required variables above. Aborting."
    exit 1
fi

echo ""
echo "Tearing down preview for PR #${PR_NUMBER}..."

# ── Kubeconfig ────────────────────────────────────────────────────────────────
if [ -z "${KUBECONFIG:-}" ] || [ ! -f "${KUBECONFIG}" ]; then
    echo "Fetching kubeconfig from 1Password..."
    KUBECONFIG_TMP=$(mktemp)
    op read "${KUBECONFIG_ITEM}" > "$KUBECONFIG_TMP"
    chmod 600 "$KUBECONFIG_TMP"
    export KUBECONFIG="$KUBECONFIG_TMP"
fi

kubectl config use-context "${KUBE_CONTEXT}"

# ── Delete namespace ──────────────────────────────────────────────────────────
kubectl delete namespace "pr-${PR_NUMBER}" \
    --ignore-not-found=true --wait=false

echo "Namespace pr-${PR_NUMBER} deletion initiated."
echo "Cascade removes: Deployment, Service, HTTPRoute."
echo "external-dns will delete the DNS record automatically."
