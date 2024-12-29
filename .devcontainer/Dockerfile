# Dockerfile
FROM mcr.microsoft.com/devcontainers/base:jammy

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    zsh \
    wget \
    && rm -rf /var/lib/apt/lists/*
USER vscode
# COPY .zprofile /home/vscode/.zprofile
# COPY .zshrc /home/vscode/.zshrc
# RUN chown vscode:vscode /home/vscode/.zprofile /home/vscode/.zshrc
