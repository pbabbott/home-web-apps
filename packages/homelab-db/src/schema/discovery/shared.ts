import type { z } from 'zod';

export const dateTime = (schema: z.ZodDate) =>
  schema.meta({ format: 'date-time' });
