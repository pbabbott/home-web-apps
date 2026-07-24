import { Express } from 'express';
import { configureErrorHandler } from './error-handler';

describe('configureErrorHandler (unit test)', () => {
  it('registers a 4-arg error-handling middleware on the provided app', () => {
    const mockApp = { use: jest.fn() } as unknown as Express;

    configureErrorHandler(mockApp);

    expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function));

    const handler = (mockApp.use as jest.Mock).mock.calls[0][0];
    expect(handler).toHaveLength(4);
  });
});
