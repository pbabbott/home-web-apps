#!/usr/bin/env bash
# Usage: . ./scripts/turbo-auth.sh && pnpm turbo build
# In CI, TURBO_TOKEN and TURBO_API are pod-injected — op fetch is skipped.
if [ -z "$TURBO_TOKEN" ]; then
  export TURBO_TOKEN=$(op item get "turbo-cache-token" --vault Homelab --format=json | jq -r '.fields[] | select(.label=="turbo-cache-token") | .value')
fi
export TURBO_API=${TURBO_API:-https://turborepo-cache.local.non-prod.abbottland.io}
export TURBO_TEAM=abbottland
