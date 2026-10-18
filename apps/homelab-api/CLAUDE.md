# CLAUDE.md

Guidance for `apps/homelab-api`. Index only — see [Documentation Conventions](../../docs/dev-guide-documentation-conventions.md).

- Keep [`README.md`](./README.md) up to date when routes, MCP tools, or the discovery workflow change — especially the MCP tool → REST route table, which is hand-maintained and drifts silently. Update it in the same change as the code (`src/mcp.ts`, `src/controllers/`).
- Keep the OpenAPI docs (`src/openapi/`) in step with controller and schema changes.
- Exodus design and decisions: [`docs/exodus/`](../../docs/exodus/README.md).
