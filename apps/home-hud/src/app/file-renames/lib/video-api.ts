const VIDEO_API_URL = process.env.VIDEO_API_URL ?? 'http://localhost:4002';

export type FileRenameStatus = 'pending' | 'applied' | 'rejected';

export interface FileRename {
  id: string;
  fileHash: string;
  originalFilePath: string;
  suggestedFilePath: string;
  sourceTitleCardTitles: string[] | null;
  status: FileRenameStatus;
  createdAt: string;
  appliedAt: string | null;
}

export async function getFileRenames(): Promise<FileRename[]> {
  const res = await fetch(`${VIDEO_API_URL}/file-renames`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `video-api GET /file-renames returned ${res.status}: ${body}`,
    );
  }

  const data: { fileRenames: FileRename[] } = await res.json();
  return data.fileRenames;
}
