# CLAUDE.md

Guidance for `packages/homelab-db`. Index only — see [Documentation Conventions](../../docs/dev-guide-documentation-conventions.md).

- Keep [`ERD.md`](./ERD.md) up to date whenever the schema in `src/schema/` changes (tables, columns, relations, delete rules, migrations). Update it in the same change as the migration.
- Queries are split by subdomain under `src/queries/` (e.g. `src/queries/discovery/`); add new queries to the matching file rather than growing one big file.
