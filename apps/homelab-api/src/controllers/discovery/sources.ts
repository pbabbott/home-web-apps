import * as discoveryService from '../../services/discovery';
import { handle } from './handle';
import type { CreateSourceBody } from '../../schemas/discovery';

export const createSource = handle('POST /sources', async (req, res) => {
  const body = req.body as CreateSourceBody;
  res.status(201).json(await discoveryService.createSource(body));
});

export const listSources = handle('GET /sources', async (_req, res) => {
  res.status(200).json(await discoveryService.listSources());
});
