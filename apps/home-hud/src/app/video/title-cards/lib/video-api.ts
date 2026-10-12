const VIDEO_API_URL = process.env.VIDEO_API_URL ?? 'http://localhost:4002';

export interface TitleCard {
  id: string;
  fileHash: string;
  filePath: string;
  timestampSeconds: number;
  runTimeSeconds: number | null;
  title: string | null;
  screenshotPath: string | null;
  screenshotBase64: string | null;
  createdAt: string;
}

export async function getTitleCards(season?: number): Promise<TitleCard[]> {
  const url = new URL(`${VIDEO_API_URL}/title-cards`);
  if (season !== undefined) {
    url.searchParams.set('season', String(season));
  }

  const res = await fetch(url, {
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
