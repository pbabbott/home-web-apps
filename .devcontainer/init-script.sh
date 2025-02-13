#!/bin/bash

# Filepath: /workspaces/home-web-apps/.devcontainer/init-script.sh

# Setup a docker builder in-case of wanting to use buildx
# Check if the builder named 'mybuilder' exists, if not, create it

# TODO: fix this code
# if ! docker buildx inspect mybuilder > /dev/null 2>&1; then
#     docker buildx create --use --name mybuilder --driver docker-container
# fi

docker run --privileged --rm tonistiigi/binfmt --install all