const VIDEO_API_URL = process.env.VIDEO_API_URL ?? 'http://localhost:4002';

export interface TitleCard {
  id: string;
  fileHash: string;
  filePath: string;
  timestampSeconds: number;
  runTimeSeconds: number | null;
  title: string | null;
  screenshotPath: string | null;
  createdAt: string;
}

export async function getTitleCards(): Promise<TitleCard[]> {
  const res = await fetch(`${VIDEO_API_URL}/title-cards`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `video-api GET /title-cards returned ${res.status}: ${body}`,
    );
  }

  const data: { titleCards: TitleCard[] } = await res.json();
  return data.titleCards;
}
