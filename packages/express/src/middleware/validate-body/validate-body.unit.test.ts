import { Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from './validate-body';

describe('validateBody (unit test)', () => {
  const schema = z.object({ name: z.string() });

  it('calls next() and normalizes req.body on success', () => {
    const req = { body: { name: 'a' } } as Request;
    const res = {} as Response;
    const next = jest.fn();

    validateBody(schema)(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ name: 'a' });
  });

  it('responds 400 with field errors and does not call next() on failure', () => {
    const req = { body: { name: 123 } } as unknown as Request;
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const res = { status } as unknown as Response;
    const next = jest.fn();

    validateBody(schema)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: expect.arrayContaining([
          expect.objectContaining({ field: 'name' }),
        ]),
      }),
    );
  });
});
