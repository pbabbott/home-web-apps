# Using the node:22 image as the base image
# Need lots of tools for dev image like bash, node, python, etc.
FROM node:22

# libc6-compat needed for pnpm
# bash needed for pi-led-api 
RUN apt-get update && apt-get install -y \
    libc6 \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Set bash as the default shell (optional)
SHELL ["/bin/bash", "-c"]