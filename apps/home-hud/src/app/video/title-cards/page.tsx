import { TitleCardsClient } from './TitleCardsClient';
import { getTitleCards } from './lib/video-api';
import { getSeries, type Series } from '../series/lib/video-api';

interface TitleCardsPageProps {
  searchParams: Promise<{ season?: string; series?: string }>;
}

export default async function TitleCardsPage({
  searchParams,
}: TitleCardsPageProps) {
  const { season: seasonParam, series: seriesParam } = await searchParams;
  const season = seasonParam ? Number(seasonParam) : null;

  let titleCards = null;
  let series: Series[] = [];

  try {
    titleCards = await getTitleCards(season ?? undefined, seriesParam);
  } catch (err) {
    console.error('Failed to load title cards from video-api:', err);
  }

  try {
    series = await getSeries();
  } catch (err) {
    console.error('Failed to load series from video-api:', err);
  }

  return (
    <TitleCardsClient
      titleCards={titleCards}
      selectedSeason={season}
      selectedSeries={seriesParam ?? null}
      series={series}
    />
  );
}
