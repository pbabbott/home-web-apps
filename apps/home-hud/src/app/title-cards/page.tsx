import { TitleCardsClient } from './TitleCardsClient';
import { getTitleCards } from './lib/video-api';

interface TitleCardsPageProps {
  searchParams: Promise<{ season?: string }>;
}

export default async function TitleCardsPage({
  searchParams,
}: TitleCardsPageProps) {
  const { season: seasonParam } = await searchParams;
  const season = seasonParam ? Number(seasonParam) : null;

  let titleCards = null;

  try {
    titleCards = await getTitleCards(season ?? undefined);
  } catch (err) {
    console.error('Failed to load title cards from video-api:', err);
  }

  return <TitleCardsClient titleCards={titleCards} selectedSeason={season} />;
}
