import { upsertTitleCard, type TitleCard } from '@abbottland/video-db';
import { db } from '../../../../db';
import { JobProcessingError } from '../../../job-processing-error';
import type { Step } from '../../pipeline';
import type { PawPatrolTitleCardsContext } from '../context';
import type { Episode } from '../episode';
import type { TitleCardDetection } from '../lib/detect-title-card';
import { seasonDirectoryRelPath } from '../lib/paths';

type FoundDetection = TitleCardDetection & { found: true; title: string };

const isFound = (detection: TitleCardDetection): detection is FoundDetection =>
  detection.found;

/**
 * One row per distinct title text found for the episode — not one per
 * matching screenshot. The same title routinely shows up in several
 * consecutive sample screenshots (the card stays on screen for seconds),
 * and writing a row per screenshot would create duplicate rows for the
 * same title at different timestamps. Keeps the first (earliest
 * timestamp) occurrence of each title; later duplicates are dropped. A
 * genuinely different second title later in the episode (a different
 * fileHash + title pair) still gets its own row — duplicate hashes are
 * fine, duplicate titles for the same hash are not.
 */
const dedupeByTitle = (detections: TitleCardDetection[]): FoundDetection[] => {
  const byTitle = new Map<string, FoundDetection>();

  for (const detection of detections.filter(isFound)) {
    if (!byTitle.has(detection.title)) {
      byTitle.set(detection.title, detection);
    }
  }

  return [...byTitle.values()];
};

/**
 * For each episode with no title_cards record, inserts one title_cards row
 * per distinct title the previous step's AI detections found (skipped
 * entirely if none did). Episodes that already have title_cards records
 * pass through unchanged.
 */
export const insertEpisodeTitleCards: Step<PawPatrolTitleCardsContext> = async (
  ctx,
) => {
  const episodes: Episode[] = [];

  for (const episode of ctx.episodes) {
    if (episode.titleCards && episode.titleCards.length > 0) {
      episodes.push(episode);
      continue;
    }

    if (!episode.titleCardDetections) {
      throw new JobProcessingError(
        `episode is missing title card detections: ${episode.filename}`,
      );
    }

    if (!episode.hash) {
      throw new JobProcessingError(
        `episode is missing a hash: ${episode.filename}`,
      );
    }

    if (episode.runTimeSeconds === undefined) {
      throw new JobProcessingError(
        `episode is missing a runtime: ${episode.filename}`,
      );
    }

    const filePath = `${seasonDirectoryRelPath(ctx.seasonNumber)}/${episode.filename}`;
    const titleCards: TitleCard[] = [];

    for (const detection of dedupeByTitle(episode.titleCardDetections)) {
      titleCards.push(
        await upsertTitleCard(db, {
          fileHash: episode.hash,
          filePath,
          timestampSeconds: detection.timestampSeconds,
          runTimeSeconds: episode.runTimeSeconds,
          title: detection.title,
          screenshotPath: detection.screenshotPath,
          screenshotBase64: detection.screenshotBase64,
        }),
      );
    }

    episodes.push({ ...episode, titleCards });
  }

  return { ...ctx, episodes };
};
