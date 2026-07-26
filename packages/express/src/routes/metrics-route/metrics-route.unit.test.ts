import { Express } from 'express';
import { configureMetricsRoute } from './metrics-route';

describe('configureMetricsRoute (unit test)', () => {
  it('should configure the metrics endpoint on the provided Express app', () => {
    const mockApp = {
      get: jest.fn(),
    } as unknown as Express;

    configureMetricsRoute(mockApp);

    expect(mockApp.get).toHaveBeenCalledWith('/metrics', expect.any(Function));
  });
});
