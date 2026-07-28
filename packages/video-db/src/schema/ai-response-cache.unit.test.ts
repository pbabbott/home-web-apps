import { aiResponseCacheSelectSchema } from './ai-response-cache';

describe('aiResponseCacheSelectSchema', () => {
  it('accepts a realistic row shape', () => {
    const result = aiResponseCacheSelectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      screenshotPath: 'screenshots/Paw Patrol/Season 3/hash-1/45_480x270.jpg',
      model: 'qwen/qwen3-vl-8b-instruct',
      response: { found: true, title: 'Pups Save a Blimp' },
      createdAt: new Date(),
    });

    expect(result.success).toBe(true);
  });

  it('accepts a found:false response', () => {
    const result = aiResponseCacheSelectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      screenshotPath: 'screenshots/Paw Patrol/Season 3/hash-1/31_480x270.jpg',
      model: 'qwen/qwen3-vl-8b-instruct',
      response: { found: false },
      createdAt: new Date(),
    });

    expect(result.success).toBe(true);
  });

  it('rejects a row missing model', () => {
    const result = aiResponseCacheSelectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      screenshotPath: 'screenshots/x/45_480x270.jpg',
      response: { found: false },
      createdAt: new Date(),
    });

    expect(result.success).toBe(false);
  });
});
