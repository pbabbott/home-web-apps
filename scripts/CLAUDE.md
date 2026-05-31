# Scripts

Every script must be locally runnable, not just callable from CI.

## Authoring conventions

- Shebang: `#!/usr/bin/env bash` (not `/bin/bash`)
- `set -euo pipefail` near the top
- `cd "$(dirname "$0")/.."` so relative paths resolve from the repo root
- `# Local usage:` comment block at the top — show the minimal invocation and any required env vars
- Inputs via env vars with sensible defaults: `VAR="${VAR:-default}"`

`deploy-preview.sh` is the canonical example.

## Secrets

Scripts fetch all credentials from 1Password directly — they are never injected as individual secrets from CI. The only input from CI is `OP_CONNECT_HOST` and `OP_CONNECT_TOKEN`, which the script uses to authenticate the `op` CLI.

`docker-login.sh` is the canonical example: it fetches Harbor credentials internally via `op item get`, and falls back gracefully when credentials are provided directly (for local overrides or testing).

## Local invocation

```bash
bash ./scripts/script-name.sh
VAR=value bash ./scripts/script-name.sh
```

## CI integration

See `.github/CLAUDE.md` — CI steps call scripts and pass vars via `env:`.
