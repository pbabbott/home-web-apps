import { Router } from 'express';
import { validateParams, validateQuery } from '@abbottland/express';
import { getMap } from '../controllers/maps';
import { mapQuerySchema, mapTypeParamsSchema } from '../schemas/maps';

export const mapsRouter = Router();

mapsRouter.get(
  '/maps/:type',
  validateParams(mapTypeParamsSchema),
  validateQuery(mapQuerySchema),
  getMap,
);
