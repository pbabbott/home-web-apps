import type { NamedStep } from '../../pipeline';
import type { PawPatrolTitleCardsContext } from '../context';
import { checkTitleCardRecords } from './check-title-card-records';
import { computeEpisodeRuntime } from './compute-episode-runtime';
import { detectEpisodeTitleCards } from './detect-episode-title-cards';
import { generateEpisodeScreenshots } from './generate-episode-screenshots';
import { hashEpisodeFiles } from './hash-episode-files';
import { insertEpisodeTitleCards } from './insert-episode-title-cards';
import { listSeasonFiles } from './list-season-files';

/** Ordered pipeline for the paw_patrol_title_cards operation — one step per file in this directory. */
export const steps: NamedStep<PawPatrolTitleCardsContext>[] = [
  {
    name: 'list-season-files',
    message: 'Listing season files',
    run: listSeasonFiles,
  },
  {
    name: 'hash-episode-files',
    message: 'Hashing episode files',
    run: hashEpisodeFiles,
  },
  {
    name: 'check-title-card-records',
    message: 'Checking existing title-card records',
    run: checkTitleCardRecords,
  },
  {
    name: 'compute-episode-runtime',
    message: 'Computing episode runtimes',
    run: computeEpisodeRuntime,
  },
  {
    name: 'generate-episode-screenshots',
    message: 'Generating episode screenshots',
    run: generateEpisodeScreenshots,
  },
  {
    name: 'detect-episode-title-cards',
    message: 'Detecting title cards',
    run: detectEpisodeTitleCards,
  },
  {
    name: 'insert-episode-title-cards',
    message: 'Writing title-card records',
    run: insertEpisodeTitleCards,
  },
];
