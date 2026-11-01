# CLAUDE.md

Guidance for `apps/backup-worker`. Index only — see [Documentation Conventions](../../docs/dev-guide-documentation-conventions.md).

- What the worker does, the copy algorithm, the error-to-outcome table and the destination layout live in [`docs/exodus/backup.md`](../../docs/exodus/backup.md) (start at [Worker](../../docs/exodus/backup.md#worker) and [Copy engine](../../docs/exodus/backup.md#copy-engine)). Update that page in the same change as any behaviour change.
- Invariants any change must keep: every write to a job item or entry carries the `claimToken` (proof of the lease); the destination is only ever added to (never overwrite or delete outside `.exodus-staging`); every step is safe to interrupt and repeat.
- New copy errors extend `CopyError` (`src/lib/copy-error.ts`, declared in `src/copy/errors.ts`) and must be handled in `abandon()` (`src/copy/run.ts`) or recorded on the entry (`toEntryFailure` in `src/copy/entry.ts`); document the new row in the "item that does not settle" table.
- Crash-safety is tested by injecting a `FaultHook` at named points (`ctx.fault('entry:after-link', …)`) through `tests/integration/helpers/copy-harness.ts`. Add a fault point and a test when adding a step that writes to the destination or database.
- Run `pnpm test:unit` and `pnpm test:int` (the integration tests need Postgres from `pnpm dev:deps`; see [Running and testing](../../docs/exodus/operations.md#running-and-testing)).
- Operating the worker (pauses, stalled mount, deployment requirements): [`docs/exodus/operations.md`](../../docs/exodus/operations.md). Setup and configuration: [`README.md`](./README.md).
