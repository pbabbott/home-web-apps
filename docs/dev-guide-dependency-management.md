# Dev Guide - Dependency Management

The purpose of this document is to explain when and how to use the pnpm workspace catalog (`pnpm-workspace.yaml`) for shared dependencies.

## When to use the catalog

If a dependency is pinned to the same version range in two or more `apps/*`/`packages/*`, move it into `catalog:` in `pnpm-workspace.yaml` and reference it as `"<dep>": "catalog:"` everywhere it's used. Don't let identical ranges drift out of sync across packages — a version bump applied to one copy and forgotten in another is a common source of subtle build/runtime mismatches.

## Conventions

- Catalog entries use caret ranges (`^x.y.z`) by default, matching the rest of the catalog. Only hard-pin (no `^`) with a specific reason, and leave a comment explaining why.
- Packages whose versions must track each other in lockstep belong in the catalog together. Example: `next` and `eslint-config-next` — `eslint-config-next` is meant to match the installed `next` version, so if only `next` is bumped (e.g. in one app's `package.json`), `eslint-config-next` silently goes stale. Cataloging both means a single version source and no drift.

## Adding a new catalog entry

1. Add the entry to `catalog:` in `pnpm-workspace.yaml`, grouped near related entries (e.g. React-ecosystem deps together, test-tooling deps together).
2. In each `package.json` that uses it, replace the version range with `"catalog:"`.
3. Run `pnpm install` to update the lockfile.
4. Rebuild/lint the affected packages to confirm the resolved version works: `pnpm turbo build lint --filter=<pkg>`.
