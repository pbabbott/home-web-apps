import type { Step } from '../../pipeline';
import type { PawPatrolTitleCardsContext } from '../context';
import { checkTitleCardRecords } from './check-title-card-records';
import { computeEpisodeRuntime } from './compute-episode-runtime';
import { detectEpisodeTitleCards } from './detect-episode-title-cards';
import { generateEpisodeScreenshots } from './generate-episode-screenshots';
import { hashEpisodeFiles } from './hash-episode-files';
import { insertEpisodeTitleCards } from './insert-episode-title-cards';
import { listSeasonFiles } from './list-season-files';

/** Ordered pipeline for the paw_patrol_title_cards operation — one step per file in this directory. */
export const steps: Step<PawPatrolTitleCardsContext>[] = [
  listSeasonFiles,
  hashEpisodeFiles,
  checkTitleCardRecords,
  computeEpisodeRuntime,
  generateEpisodeScreenshots,
  detectEpisodeTitleCards,
  insertEpisodeTitleCards,
];
