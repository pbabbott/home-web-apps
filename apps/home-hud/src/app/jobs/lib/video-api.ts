const VIDEO_API_URL = process.env.VIDEO_API_URL ?? 'http://localhost:4002';

export type VideoJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface VideoJob {
  id: string;
  operation: string;
  status: VideoJobStatus;
  parameters: Record<string, unknown>;
  workerId: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  heartbeatAt: string | null;
  error: string | null;
  message: string | null;
}

export async function getJobs(): Promise<VideoJob[]> {
  const res = await fetch(`${VIDEO_API_URL}/jobs`, { cache: 'no-store' });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`video-api GET /jobs returned ${res.status}: ${body}`);
  }

  const data: { jobs: VideoJob[] } = await res.json();
  return data.jobs;
}

export async function getJobById(id: string): Promise<VideoJob | null> {
  const res = await fetch(`${VIDEO_API_URL}/jobs/${id}`, { cache: 'no-store' });

  if (res.status === 404) return null;

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `video-api GET /jobs/${id} returned ${res.status}: ${body}`,
    );
  }

  return res.json();
}

export type AiStatus =
  | { online: true; models: string[] }
  | { online: false; models: [] };

export async function getAiStatus(): Promise<AiStatus> {
  const res = await fetch(`${VIDEO_API_URL}/ai/status`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`video-api GET /ai/status returned ${res.status}: ${body}`);
  }

  return res.json();
}
