const VIDEO_API_URL = process.env.VIDEO_API_URL ?? 'http://localhost:4002';

export interface Series {
  id: string;
  seriesName: string;
  directoryName: string;
  seasonCount: number;
  createdAt: string;
}

export async function getSeries(): Promise<Series[]> {
  const res = await fetch(`${VIDEO_API_URL}/series`, { cache: 'no-store' });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`video-api GET /series returned ${res.status}: ${body}`);
  }

  const data: { series: Series[] } = await res.json();
  return data.series;
}
