import type { Step } from '../../pipeline';
import type { PawPatrolTitleCardsContext } from '../context';
import { checkTitleCardRecords } from './check-title-card-records';
import { computeEpisodeRuntime } from './compute-episode-runtime';
import { generateEpisodeScreenshots } from './generate-episode-screenshots';
import { hashEpisodeFiles } from './hash-episode-files';
import { listSeasonFiles } from './list-season-files';

/**
 * Ordered pipeline for the paw_patrol_title_cards operation — one step per
 * file in this directory. More steps (detect the title card from the
 * generated screenshots, insert the title_cards record, ...) land here
 * next.
 */
export const steps: Step<PawPatrolTitleCardsContext>[] = [
  listSeasonFiles,
  hashEpisodeFiles,
  checkTitleCardRecords,
  computeEpisodeRuntime,
  generateEpisodeScreenshots,
];
