import * as discoveryService from '../../services/discovery';
import { handle } from './handle';
import type { Operation } from '../operation';
import type { CreateSourceBody } from '../../schemas/discovery';

// Does: register a source (a machine to explore).
// Who: human (home-hud add-source modal). No MCP tool.
export const createSourceOperation = {
  summary: 'Register a source (a machine to explore)',
} satisfies Operation;

export const createSource = handle('POST /sources', async (req, res) => {
  const body = req.body as CreateSourceBody;
  res.status(201).json(await discoveryService.createSource(body));
});

// Does: list all sources.
// Who: human (home-hud sources page). No MCP tool.
export const listSourcesOperation = {
  summary: 'List sources',
} satisfies Operation;

export const listSources = handle('GET /sources', async (_req, res) => {
  res.status(200).json(await discoveryService.listSources());
});
