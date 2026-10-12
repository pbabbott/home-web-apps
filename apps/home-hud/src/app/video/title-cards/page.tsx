import { TitleCardsClient } from './TitleCardsClient';
import { getTitleCards } from './lib/video-api';
import { getSeries, type Series } from '../series/lib/video-api';

const FIRST_SEASON = 1;

interface TitleCardsPageProps {
  searchParams: Promise<{ season?: string; series?: string }>;
}

export default async function TitleCardsPage({
  searchParams,
}: TitleCardsPageProps) {
  const { season: seasonParam, series: seriesParam } = await searchParams;

  let series: Series[] = [];

  try {
    series = await getSeries();
  } catch (err) {
    console.error('Failed to load series from video-api:', err);
  }

  const selectedSeries = seriesParam ?? series[0]?.seriesName ?? null;
  const season = seasonParam ? Number(seasonParam) : FIRST_SEASON;

  let titleCards = null;

  try {
    titleCards = await getTitleCards(
      season ?? undefined,
      selectedSeries ?? undefined,
    );
  } catch (err) {
    console.error('Failed to load title cards from video-api:', err);
  }

  return (
    <TitleCardsClient
      titleCards={titleCards}
      selectedSeason={season}
      selectedSeries={selectedSeries}
      series={series}
    />
  );
}
