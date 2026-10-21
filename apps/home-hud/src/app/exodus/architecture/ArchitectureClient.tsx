'use client';

import {
  Badge,
  HexagonalBackground,
  OutlinedButton,
  Panel,
  ScrollableTable,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Td,
  Th,
  Typography,
} from '@abbottland/fui-components';
import type { McpServerInfo, RestOperation } from '../sources/lib/homelab-api';

const ACTORS = [
  {
    title: 'ACTOR: HUMAN',
    fields: [
      ['INTERFACE', 'home-hud /exodus/*'],
      ['TRANSPORT', 'REST'],
      [
        'OPS',
        'source.register job.start job.complete job.cancel inventory.decide rule.manage audit.read',
      ],
    ],
  },
  {
    title: 'ACTOR: AGENT',
    fields: [
      ['IDENTITY', 'openclaw'],
      ['TRIGGER', 'cron'],
      ['STATE', 'none between runs'],
      ['TRANSPORT', 'MCP'],
      ['OPS', 'claim inspect propose complete'],
      ['DECISIONS', 'none'],
    ],
  },
  {
    title: 'SERVICE: HOMELAB-API',
    fields: [
      ['ENDPOINTS', 'REST, POST /mcp'],
      ['SHARED', 'service layer, audit log'],
      ['ROLE', 'sole writer to database'],
    ],
  },
  {
    title: 'STORE: POSTGRES',
    fields: [
      ['SCHEMA', 'homelab-db'],
      [
        'ENTITIES',
        'sources jobs queue_items inventory_items exclusion_rules audit_events',
      ],
      ['ROLE', 'source of truth'],
      ['UNWRITTEN DATA', 'lost'],
    ],
  },
] as const;

const FLOW = [
  'HUMAN > HOME-HUD > HOMELAB-API [REST] > POSTGRES',
  'AGENT > HOMELAB-API [MCP] > POSTGRES',
  'AGENT > WINDOWS-HOST [READ-ONLY, OUTSIDE API]',
  'COPY-WORKFLOW > INVENTORY_ITEMS [DECISION=APPROVED] [STATUS: NOT BUILT]',
];

/** Exodus domains shown here, in display order; each is a Swagger UI tag. */
const ROUTE_GROUPS = [
  'Sources',
  'Discovery Jobs',
  'Queue Items',
  'Inventory Items',
  'Exclusion Rules',
  'Audit Events',
];

function RoutesTable({ operations }: { operations: RestOperation[] }) {
  return (
    <Panel color="default" className="mb-2">
      <ScrollableTable className="mb-0">
        <Table size="small">
          <TableHead>
            <TableRow>
              <Th>Route</Th>
              <Th>Summary</Th>
              <Th>Called by</Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {operations.map((operation) => (
              <TableRow key={`${operation.method} ${operation.path}`}>
                <Td className="break-all">
                  <Typography variant="body2" component="span">
                    {operation.method} {operation.path}
                  </Typography>
                </Td>
                <Td>
                  <Typography variant="body2" component="span">
                    {operation.summary}
                  </Typography>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    {operation.hudPage && (
                      <Badge color="primary">hud · {operation.hudPage}</Badge>
                    )}
                    {operation.mcpTool && (
                      <Badge color="accent-purple">
                        agent · {operation.mcpTool}
                      </Badge>
                    )}
                    {!operation.hudPage && !operation.mcpTool && (
                      <Badge color="dark">swagger only</Badge>
                    )}
                  </div>
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollableTable>
    </Panel>
  );
}

interface ArchitectureClientProps {
  /** Null if the MCP tools could not be loaded. */
  mcp: McpServerInfo | null;
  /** Null if the OpenAPI spec could not be loaded. */
  operations: RestOperation[] | null;
  swaggerUrl: string;
}

export function ArchitectureClient({
  mcp,
  operations,
  swaggerUrl,
}: ArchitectureClientProps) {
  return (
    <main className="relative min-h-screen p-8">
      <div className="absolute inset-0">
        <HexagonalBackground />
      </div>
      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-6 bg-neutral-800 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Typography variant="h1" component="h1" className="mb-2">
              SYSTEM ARCHITECTURE
            </Typography>
            <Typography variant="body2" className="text-neutral-400">
              CALLER MAP. SOURCE: homelab-api /mcp /openapi.json. READ AT
              REQUEST TIME.
            </Typography>
          </div>
          <OutlinedButton
            component="a"
            href={swaggerUrl}
            target="_blank"
            rel="noreferrer"
            size="small"
          >
            OPEN SWAGGER /docs
          </OutlinedButton>
        </div>

        <section className="flex flex-col gap-3">
          <Typography variant="h2" component="h2" className="mb-2">
            TOPOLOGY
          </Typography>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {ACTORS.map((actor) => (
              <Panel key={actor.title} color="default" className="mb-2">
                <div className="flex flex-col gap-2">
                  <Typography variant="h3" component="h3" className="mb-2">
                    {actor.title}
                  </Typography>
                  <div className="m-0 flex flex-col gap-1">
                    {actor.fields.map(([label, value]) => (
                      <div key={label}>
                        <Typography
                          variant="body2"
                          component="p"
                          className="text-neutral-400"
                        >
                          {label}:
                        </Typography>
                        <Typography
                          variant="body2"
                          component="p"
                          className="m-0 break-words text-neutral-200"
                        >
                          {value}
                        </Typography>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>
            ))}
          </div>
          <Panel color="default" className="mb-2">
            <ul className="flex list-none flex-col gap-1 p-0">
              {FLOW.map((line) => (
                <li key={line}>
                  <Typography variant="body2">{line}</Typography>
                </li>
              ))}
            </ul>
          </Panel>
        </section>

        <section className="flex flex-col gap-3">
          <Typography variant="h2" component="h2" className="mb-2">
            MCP TOOLS [CALLER: AGENT]
          </Typography>
          {mcp === null ? (
            <Typography variant="body2" className="text-error-400">
              ERR: MCP TOOL LIST UNAVAILABLE. SOURCE: homelab-api /mcp.
            </Typography>
          ) : (
            <Panel color="default" className="mb-2">
              <ScrollableTable className="mb-0">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <Th>Tool</Th>
                      <Th>Description</Th>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {mcp.tools.map((tool) => (
                      <TableRow key={tool.name}>
                        <Td className="whitespace-nowrap">
                          <Typography variant="body2" component="span">
                            {tool.name}
                          </Typography>
                        </Td>
                        <Td>
                          <Typography variant="body2" component="span">
                            {tool.description}
                          </Typography>
                        </Td>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTable>
            </Panel>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <Typography variant="h2" component="h2" className="mb-2">
            REST ROUTES [CALLERS]
          </Typography>
          <Typography variant="body2" className="text-neutral-400">
            TAG hud: CALLED BY A home-hud PAGE. TAG agent: CALLED BY AN MCP
            TOOL. TAG swagger only: NO CALLER IN THE SYSTEM.
          </Typography>
          {operations === null ? (
            <Typography variant="body2" className="text-error-400">
              ERR: OPENAPI SPEC UNAVAILABLE. SOURCE: homelab-api /openapi.json.
            </Typography>
          ) : (
            ROUTE_GROUPS.map((group) => {
              const rows = operations.filter(({ tag }) => tag === group);

              return rows.length === 0 ? null : (
                <div key={group} className="flex flex-col gap-2">
                  <Typography variant="h3" component="h3" className="mb-2">
                    {group.toUpperCase()}
                  </Typography>
                  <RoutesTable operations={rows} />
                </div>
              );
            })
          )}
        </section>

        {mcp?.instructions && (
          <section className="flex flex-col gap-3">
            <Typography variant="h2" component="h2" className="mb-2">
              AGENT INSTRUCTIONS
            </Typography>
            <Panel color="default" className="mb-2">
              <details>
                <summary className="cursor-pointer">
                  <Typography variant="body2" component="span">
                    PAYLOAD: MCP initialize.instructions
                  </Typography>
                </summary>
                <Typography
                  variant="body2"
                  className="mt-3 whitespace-pre-wrap text-neutral-300"
                >
                  {mcp.instructions}
                </Typography>
              </details>
            </Panel>
          </section>
        )}
      </div>
    </main>
  );
}
