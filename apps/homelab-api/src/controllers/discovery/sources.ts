import * as discoveryService from '../../services/discovery';
import { handle } from './handle';
import type { Operation } from '../operation';
import type {
  CreateSourceBody,
  SourceIdParams,
  UpdateSourceBody,
} from '../../schemas/discovery';

// Does: register a source (a machine to explore).
// Who: human (home-hud add-source modal). No MCP tool.
export const createSourceOperation = {
  summary: 'Register a source (a machine to explore)',
  hud: '/exodus/sources',
} satisfies Operation;

export const createSource = handle('POST /sources', async (req, res) => {
  const body = req.body as CreateSourceBody;
  res.status(201).json(await discoveryService.createSource(body));
});

// Does: list all sources.
// Who: human (home-hud sources page). No MCP tool.
export const listSourcesOperation = {
  summary: 'List sources',
  hud: '/exodus/sources',
} satisfies Operation;

export const listSources = handle('GET /sources', async (_req, res) => {
  res.status(200).json(await discoveryService.listSources());
});

// Does: rename a source or change which host it is linked to.
// Who: human (home-hud edit-source modal). No MCP tool.
export const updateSourceOperation = {
  summary: 'Edit a source',
  description:
    'Changes the name and/or the linked host (`hostId: null` unlinks it). The source type cannot change. Jobs, queue items and inventory items belong to the source by id, so nothing else is touched.',
  hud: '/exodus/sources',
} satisfies Operation;

export const updateSource = handle('PATCH /sources/:id', async (req, res) => {
  const { id } = req.params as SourceIdParams;
  const body = req.body as UpdateSourceBody;
  res.status(200).json(await discoveryService.updateSource(id, body));
});
