# Dockerfile
FROM mcr.microsoft.com/devcontainers/base:jammy

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    zsh \
    wget \
    dnsutils \
    && rm -rf /var/lib/apt/lists/*

USER vscode

