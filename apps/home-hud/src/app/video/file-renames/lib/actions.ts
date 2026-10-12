'use server';

const VIDEO_API_URL = process.env.VIDEO_API_URL ?? 'http://localhost:4002';

export async function deleteFileRename(id: string): Promise<void> {
  const res = await fetch(`${VIDEO_API_URL}/file-renames/${id}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `video-api DELETE /file-renames/${id} returned ${res.status}: ${body}`,
    );
  }
}

export async function deleteFileRenamesForSeason(
  seasonNumber: number,
): Promise<void> {
  const res = await fetch(
    `${VIDEO_API_URL}/file-renames?season=${seasonNumber}`,
    { method: 'DELETE' },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `video-api DELETE /file-renames returned ${res.status}: ${body}`,
    );
  }
}
