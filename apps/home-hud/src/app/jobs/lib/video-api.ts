const VIDEO_API_URL = process.env.VIDEO_API_URL ?? 'http://localhost:4002';

export type VideoJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface VideoJob {
  id: string;
  operation: string;
  status: VideoJobStatus;
  outputPaths: string[] | null;
  parameters: Record<string, unknown>;
  attempts: number;
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
