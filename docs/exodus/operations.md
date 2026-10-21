# Exodus - Running, Testing and Next Steps

[← Project Exodus](./README.md)

## Running and testing

```sh
cd apps/homelab-api
pnpm dev:deps     # Postgres on :5433
pnpm dev          # API on :4003; applies pending migrations at startup

cd apps/home-hud
pnpm dev          # UI on :4022, pages under /exodus
```

Unit tests run with `pnpm test:unit` in `packages/homelab-db` and `apps/homelab-api`. `apps/homelab-api` also has its first integration test project (`pnpm test:int`, needs `dev:deps`): it runs end to end against the real local Postgres, covering concurrent claims, lease expiry and reclaim, retry exhaustion, completion rules, the cancel/fail and enqueue races, the database state checks, and the host/source filters, and deletes everything it creates. `apps/home-hud` has unit tests (`pnpm test:unit`) for the inventory item and audit display helpers. CI picks the project up automatically through the `test:int` task. See [Postgres & Drizzle](./dev-guide-postgres-drizzle.md) and the [integration test guide](./test-guide-integration.md).

After changing `packages/homelab-db`, run `pnpm build` there: `homelab-api` loads it from `dist/` at runtime (including in Jest), so a stale build shows up as confusing "undefined" errors.

## Next steps

Not started, and not decided:

- The OpenClaw agent: how it authenticates to the API and MCP endpoint, the read-only filesystem access it uses to inspect a machine (the API grants none), and the cron cadence.
- Review UI extras: bulk approve/reject (most urgent: a Downloads folder yields many file items), search by path, and a link from an inventory item to its audit history. The copy workflow for approved inventory items.
- Nested-inventory item inheritance and overrides.
- Stale inventory items (source file since deleted or moved): detect from `lastSeenAt` or have the copy workflow report them.
- Pattern-based exclusion (globs such as `node_modules`); rules are exact paths today.
