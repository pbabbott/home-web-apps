import { z } from 'zod';

export const validationErrorSchema = z.object({
  message: z.string().meta({ example: 'Invalid query parameters' }),
  errors: z.array(
    z.object({
      field: z.string().meta({ example: 'metric' }),
      message: z.string().meta({
        example: 'Invalid option: expected one of "cpu"|"memory"|"both"',
      }),
    }),
  ),
});

export const validationErrorResponse = {
  description: 'One or more fields are missing or invalid',
  content: {
    'application/json': { schema: validationErrorSchema },
  },
};
