#!/usr/bin/env bash
# Runs once when the dev container is created (not on every open).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

echo "Fetching oh-my-zsh plugins"
ZSH_CUSTOM="${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}"
export GIT_TERMINAL_PROMPT=0
_plugins=(
  "https://github.com/zsh-users/zsh-autosuggestions|${ZSH_CUSTOM}/plugins/zsh-autosuggestions"
  "https://github.com/MichaelAquilina/zsh-you-should-use.git|${ZSH_CUSTOM}/plugins/you-should-use"
)
for _pair in "${_plugins[@]}"; do
  IFS='|' read -r _url _dest <<<"$_pair"
  [ -d "$_dest" ] || git clone --depth 1 "$_url" "$_dest"
done
unset _pair _url _dest _plugins

echo "Setting up docker buildx"
if ! docker buildx inspect mybuilder > /dev/null 2>&1; then
  docker buildx create --use --name mybuilder --driver docker-container
else
  docker buildx use mybuilder
fi

echo "Installing binfmt for cross-platform builds"
docker run --privileged --rm tonistiigi/binfmt --install all

echo "Installing dependencies"
pnpm install

echo "Installing Playwright browsers and system dependencies"
pnpm --filter @abbottland/fui-components exec playwright install --with-deps chromium
