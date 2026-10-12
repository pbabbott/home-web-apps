'use server';

const VIDEO_API_URL = process.env.VIDEO_API_URL ?? 'http://localhost:4002';

export type JobOperation =
  | 'paw_patrol_title_cards'
  | 'paw_patrol_file_suggestions'
  | 'paw_patrol_apply_file_renames';

export async function createJob(
  operation: JobOperation,
  seasonNumber?: number,
  model?: string,
): Promise<void> {
  const parameters = {
    ...(seasonNumber !== undefined && { seasonNumber }),
    ...(model && { model }),
  };

  const body = Object.keys(parameters).length
    ? { operation, parameters }
    : { operation };

  const res = await fetch(`${VIDEO_API_URL}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`video-api POST /jobs returned ${res.status}: ${body}`);
  }
}
