import { Request, Response } from 'express';
import { z } from 'zod';
import { validateQuery } from './validate-query';

describe('validateQuery (unit test)', () => {
  const schema = z.object({
    status: z.enum(['pending', 'completed']).optional(),
  });

  it('calls next() and normalizes req.query on success', () => {
    const req = { query: { status: 'pending' } } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn();

    validateQuery(schema)(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.query).toEqual({ status: 'pending' });
  });

  it('responds 400 with field errors and does not call next() on failure', () => {
    const req = { query: { status: 'bogus' } } as unknown as Request;
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const res = { status } as unknown as Response;
    const next = jest.fn();

    validateQuery(schema)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: expect.arrayContaining([
          expect.objectContaining({ field: 'status' }),
        ]),
      }),
    );
  });
});
