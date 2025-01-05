#!/bin/bash
set -e

if [ -z "$DOCKER_USERNAME" ] || [ -z "$DOCKER_PASSWORD" ] || [ -z "$DOCKER_REGISTRY" ]; then
    echo "Environment variables DOCKER_USERNAME, DOCKER_PASSWORD, and DOCKER_REGISTRY are not set"
    echo "Fetching values from 1Password..."
    # Fetch docker username and password from 1Password
    DOCKER_USERNAME=$(op item get "harbor.local.abbottland.io - pbabbott" --field username)
    DOCKER_PASSWORD=$(op item get "harbor.local.abbottland.io - pbabbott" --field password --reveal)
    DOCKER_REGISTRY=$(op item get "harbor.local.abbottland.io - pbabbott" --field registry)    
else
    echo "Environment variables DOCKER_USERNAME, DOCKER_PASSWORD, and DOCKER_REGISTRY are set"
fi

# Perform docker login
echo "Attempting docker login to $DOCKER_REGISTRY"
echo "$DOCKER_PASSWORD" | docker login $DOCKER_REGISTRY --username "$DOCKER_USERNAME" --password-stdin

# Replace credsStore with credStore in ~/.docker/config.json
sed -i 's/credsStore/credStore/g' ~/.docker/config.json