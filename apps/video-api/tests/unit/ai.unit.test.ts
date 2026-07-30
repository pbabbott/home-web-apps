import supertest from 'supertest';
import { createServer } from '../../src/server';
import { getAiStatus } from '../../src/api/ai/ai-client';

jest.mock('../../src/api/ai/ai-client', () => ({
  getAiStatus: jest.fn(),
}));

describe('GET /ai/status', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns the AI client status as-is when online', async () => {
    (getAiStatus as jest.Mock).mockResolvedValue({
      online: true,
      models: ['qwen/qwen3-vl-8b-instruct'],
    });

    const res = await supertest(createServer()).get('/ai/status').expect(200);

    expect(res.body).toEqual({
      online: true,
      models: ['qwen/qwen3-vl-8b-instruct'],
    });
  });

  it('returns offline status without erroring when the AI server is unreachable', async () => {
    (getAiStatus as jest.Mock).mockResolvedValue({ online: false, models: [] });

    const res = await supertest(createServer()).get('/ai/status').expect(200);

    expect(res.body).toEqual({ online: false, models: [] });
  });
});
