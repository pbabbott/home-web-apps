import { Express } from 'express';
import { configureVersionRoute } from './version-route';

describe('configureVersionRoute (unit test)', () => {
  it('should configure the version endpoint on the provided Express app', () => {
    const mockApp = { get: jest.fn() } as unknown as Express;

    configureVersionRoute(mockApp);

    expect(mockApp.get).toHaveBeenCalledWith('/version', expect.any(Function));
  });
});
