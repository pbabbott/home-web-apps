const VIDEO_API_URL = process.env.VIDEO_API_URL ?? 'http://localhost:4002';

export type VideoJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface VideoJob {
  id: string;
  operation: string;
  status: VideoJobStatus;
  inputPath: string;
  outputPaths: string[] | null;
  parameters: Record<string, unknown>;
  attempts: number;
  workerId: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  heartbeatAt: string | null;
  error: string | null;
}

export type FileRenameStatus = 'pending' | 'applied' | 'rejected';

export interface FileRename {
  id: string;
  fileHash: string;
  originalFilePath: string;
  suggestedFilePath: string;
  status: FileRenameStatus;
  createdAt: string;
  appliedAt: string | null;
}

async function throwForStatus(res: Response, route: string): Promise<never> {
  const body = await res.text();
  throw new Error(`video-api GET ${route} returned ${res.status}: ${body}`);
}

export async function getJobs(): Promise<VideoJob[]> {
  const res = await fetch(`${VIDEO_API_URL}/jobs`, { cache: 'no-store' });
  if (!res.ok) {
    return throwForStatus(res, '/jobs');
  }
  const data: { jobs: VideoJob[] } = await res.json();
  return data.jobs;
}

export async function getFileRenames(): Promise<FileRename[]> {
  const res = await fetch(`${VIDEO_API_URL}/file-renames`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    return throwForStatus(res, '/file-renames');
  }
  const data: { fileRenames: FileRename[] } = await res.json();
  return data.fileRenames;
}
