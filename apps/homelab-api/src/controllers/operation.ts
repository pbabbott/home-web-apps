/**
 * Docs for one endpoint, exported next to its handler so the description
 * can't drift from what the handler does. Read by the OpenAPI spec
 * (src/openapi.ts) and, for the agent-facing endpoints, the MCP server
 * (src/mcp.ts).
 *
 * `mcp` is present only on endpoints exposed as an MCP tool. Its description
 * is written for an agent (what to do next, what the result means) rather
 * than reused from `description`, so the two are authored separately.
 */
export type Operation = {
  summary: string;
  description?: string;
  mcp?: { name: string; description: string };
};
