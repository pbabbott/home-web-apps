import { titleCardSelectSchema } from './title-cards';

describe('titleCardSelectSchema', () => {
  it('accepts a realistic row shape', () => {
    const row = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      fileHash: 'deadbeefcafe',
      filePath: '/tv_shows/Show A/S01E01.mp4',
      timestampSeconds: 128,
      title: 'Pups Save a Toof',
      screenshotPath: '/screenshots/some-job-id/128.jpg',
      createdAt: new Date(),
    };

    const result = titleCardSelectSchema.safeParse(row);

    expect(result.success).toBe(true);
  });

  it('accepts null title and screenshotPath', () => {
    const result = titleCardSelectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      fileHash: 'deadbeefcafe',
      filePath: '/tv_shows/Show A/S01E01.mp4',
      timestampSeconds: 128,
      title: null,
      screenshotPath: null,
      createdAt: new Date(),
    });

    expect(result.success).toBe(true);
  });

  it('rejects a row missing fileHash', () => {
    const result = titleCardSelectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      filePath: '/tv_shows/Show A/S01E01.mp4',
      timestampSeconds: 128,
      title: null,
      screenshotPath: null,
      createdAt: new Date(),
    });

    expect(result.success).toBe(false);
  });
});
