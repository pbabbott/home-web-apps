import { Express } from 'express';
import { configureHealthRoute } from './health-route';

describe('configureHealthRoute (unit test)', () => {
  it('should configure the health endpoint on the provided Express app', () => {
    const mockApp = {
      get: jest.fn(),
    } as unknown as Express;

    configureHealthRoute(mockApp);

    expect(mockApp.get).toHaveBeenCalledWith('/healthz', expect.any(Function));
  });
});
