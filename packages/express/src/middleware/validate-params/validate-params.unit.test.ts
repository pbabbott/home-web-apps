import { Request, Response } from 'express';
import { z } from 'zod';
import { validateParams } from './validate-params';

describe('validateParams (unit test)', () => {
  const schema = z.object({ id: z.uuid() });

  it('calls next() on success', () => {
    const req = {
      params: { id: '123e4567-e89b-12d3-a456-426614174000' },
    } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn();

    validateParams(schema)(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('responds 400 with field errors and does not call next() on failure', () => {
    const req = { params: { id: 'not-a-uuid' } } as unknown as Request;
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const res = { status } as unknown as Response;
    const next = jest.fn();

    validateParams(schema)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: expect.arrayContaining([
          expect.objectContaining({ field: 'id' }),
        ]),
      }),
    );
  });
});
