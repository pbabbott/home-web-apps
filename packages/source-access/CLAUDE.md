# CLAUDE.md

Guidance for `packages/source-access`. Index only — see [Documentation Conventions](../../docs/dev-guide-documentation-conventions.md).

- Driver API, parsing rules and what was learned against a real source: [`README.md`](./README.md). Behaviour that depends on it: [`docs/exodus/backup.md`](../../docs/exodus/backup.md#copy-engine).
- Credentials: the password goes only in the child's environment (`PASSWD`), never argv, and the child gets a minimal environment (no app secrets such as database credentials) (`src/connections/smb-process.ts`). Paths with `;`, `"` or line breaks are refused (`assertSafeForCommand`). Keep both rules when touching process spawning.
- `FakeDriver` (`src/testing/fake-driver.ts`) is the contract `backup-worker` and `homelab-api` tests rely on. Change it together with the real driver, and keep its behaviours (reading moves the access time, faults, call log) in step with the README.
- Parsers are tested on captured `smbclient` output; add a captured sample to the unit tests when fixing a parsing bug.
- This package holds SMB code only. Schema, migrations and queries stay in `packages/homelab-db`.
- Run `pnpm test:unit`.
