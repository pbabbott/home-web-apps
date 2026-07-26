import { fileRenameSelectSchema } from './file-renames';

describe('fileRenameSelectSchema', () => {
  it('accepts a realistic pending row', () => {
    const row = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      fileHash: 'deadbeefcafe',
      originalFilePath: '/tv_shows/Show A/S01E01.mp4',
      suggestedFilePath: '/tv_shows/Show A/S01E01 - Pups Save a Toof.mp4',
      status: 'pending',
      createdAt: new Date(),
      appliedAt: null,
    };

    const result = fileRenameSelectSchema.safeParse(row);

    expect(result.success).toBe(true);
  });

  it('accepts an applied row with appliedAt set', () => {
    const result = fileRenameSelectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      fileHash: 'deadbeefcafe',
      originalFilePath: '/tv_shows/Show A/S01E01.mp4',
      suggestedFilePath: '/tv_shows/Show A/S01E01 - Pups Save a Toof.mp4',
      status: 'applied',
      createdAt: new Date(),
      appliedAt: new Date(),
    });

    expect(result.success).toBe(true);
  });

  it('rejects an invalid status', () => {
    const result = fileRenameSelectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      fileHash: 'deadbeefcafe',
      originalFilePath: '/tv_shows/Show A/S01E01.mp4',
      suggestedFilePath: '/tv_shows/Show A/S01E01 - Pups Save a Toof.mp4',
      status: 'bogus',
      createdAt: new Date(),
      appliedAt: null,
    });

    expect(result.success).toBe(false);
  });
});
