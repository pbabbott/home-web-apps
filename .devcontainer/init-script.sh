#!/bin/bash

# Filepath: /workspaces/home-web-apps/.devcontainer/init-script.sh

# Setup a docker builder in-case of wanting to use buildx
# Check if the builder named 'mybuilder' exists, if not, create it

# Setup a docker builder in-case of wanting to use buildx
# Check if the builder named 'mybuilder' exists, if not, create it
if ! docker buildx inspect mybuilder > /dev/null 2>&1; then
    docker buildx create --use --name mybuilder --driver docker-container
else
    docker buildx use mybuilder
fi


# Set up git origin to resolve push warning
git config --global push.autoSetupRemote true

# This allows for cross-platform docker builds (amd64, arm, etc)
docker run --privileged --rm tonistiigi/binfmt --install all