#!/bin/bash
set -e

if [ -z "$DOCKER_USERNAME" ] || [ -z "$DOCKER_PASSWORD" ] || [ -z "$DOCKER_REGISTRY" ]; then
    echo "Environment variables DOCKER_USERNAME, DOCKER_PASSWORD, and DOCKER_REGISTRY are not set"
    echo "Fetching values from 1Password..."
    # Fetch docker username and password from 1Password
    mkdir -p ./temp
    TEMP_FILE=./temp/harbor.json
    op item get "harbor.local.abbottland.io" --format=json --vault=Homelab > $TEMP_FILE

    DOCKER_USERNAME=$(jq -r '.fields[] | select(.id=="username") | .value' $TEMP_FILE)
    DOCKER_PASSWORD=$(jq -r '.fields[] | select(.id=="password") | .value' $TEMP_FILE)
    DOCKER_REGISTRY=https://harbor.local.abbottland.io

    rm $TEMP_FILE
else
    echo "Environment variables DOCKER_USERNAME, DOCKER_PASSWORD, and DOCKER_REGISTRY are set"
fi

# Perform docker login
echo "Attempting docker login to $DOCKER_REGISTRY"
echo "$DOCKER_PASSWORD" | docker login $DOCKER_REGISTRY --username "$DOCKER_USERNAME" --password-stdin

# Replace credsStore with credStore in ~/.docker/config.json
sed -i 's/credsStore/credStore/g' ~/.docker/config.json