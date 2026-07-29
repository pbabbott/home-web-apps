import { TitleCardsClient } from './TitleCardsClient';
import { getTitleCards } from './lib/video-api';

export default async function TitleCardsPage() {
  let titleCards = null;

  try {
    titleCards = await getTitleCards();
  } catch (err) {
    console.error('Failed to load title cards from video-api:', err);
  }

  return <TitleCardsClient titleCards={titleCards} />;
}
