'use server';

const VIDEO_API_URL = process.env.VIDEO_API_URL ?? 'http://localhost:4002';

export async function deleteTitleCard(id: string): Promise<void> {
  const res = await fetch(`${VIDEO_API_URL}/title-cards/${id}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `video-api DELETE /title-cards/${id} returned ${res.status}: ${body}`,
    );
  }
}
