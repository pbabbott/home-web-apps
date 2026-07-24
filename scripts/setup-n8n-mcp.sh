#!/usr/bin/env bash

# Local usage:
#   bash ./scripts/setup-n8n-mcp.sh
#
# Or supply the API key directly to skip 1Password:
#   N8N_API_KEY=your-api-key bash ./scripts/setup-n8n-mcp.sh

set -euo pipefail

cd "$(dirname "$0")/.."

N8N_API_URL="${N8N_API_URL:-http://n8n.local.abbottland.io}"

if [ -z "${N8N_API_KEY:-}" ]; then
    echo "Fetching n8n API key from 1Password..."
    mkdir -p ./temp
    TEMP_FILE=./temp/n8n-api-key.json
    op item get "n8n-api-key" --format=json --vault=Homelab > "$TEMP_FILE"

    N8N_API_KEY=$(jq -r '.fields[] | select(.id=="api-key") | .value' "$TEMP_FILE")

    rm "$TEMP_FILE"
else
    echo "Using provided N8N_API_KEY."
fi

claude mcp remove n8n-mcp 2>/dev/null || true

claude mcp add n8n-mcp \
    -e MCP_MODE=stdio \
    -e LOG_LEVEL=error \
    -e DISABLE_CONSOLE_OUTPUT=true \
    -e N8N_API_URL="$N8N_API_URL" \
    -e N8N_API_KEY="$N8N_API_KEY" \
    -- npx n8n-mcp

echo "n8n-mcp registered."
