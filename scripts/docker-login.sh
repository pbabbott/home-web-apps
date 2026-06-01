#!/usr/bin/env bash

# Local usage:
#   bash ./scripts/docker-login.sh
#
# Or supply credentials directly to skip 1Password:
#   DOCKER_USERNAME=user DOCKER_PASSWORD=pass DOCKER_REGISTRY=https://... bash ./scripts/docker-login.sh

set -euo pipefail

cd "$(dirname "$0")/.."

if [ -z "${DOCKER_USERNAME:-}" ] || [ -z "${DOCKER_PASSWORD:-}" ] || [ -z "${DOCKER_REGISTRY:-}" ]; then
    echo "Fetching credentials from 1Password..."
    mkdir -p ./temp
    TEMP_FILE=./temp/harbor.json
    op item get "harbor.local.abbottland.io - admin" --format=json --vault=Homelab > "$TEMP_FILE"

    DOCKER_USERNAME=$(jq -r '.fields[] | select(.id=="username") | .value' "$TEMP_FILE")
    DOCKER_PASSWORD=$(jq -r '.fields[] | select(.id=="password") | .value' "$TEMP_FILE")
    DOCKER_REGISTRY=https://harbor.local.abbottland.io

    rm "$TEMP_FILE"
else
    echo "Using provided credentials."
fi

echo "Attempting docker login to $DOCKER_REGISTRY"
echo "$DOCKER_PASSWORD" | docker login "$DOCKER_REGISTRY" --username "$DOCKER_USERNAME" --password-stdin

[ -f ~/.docker/config.json ] && sed -i 's/credsStore/credStore/g' ~/.docker/config.json
