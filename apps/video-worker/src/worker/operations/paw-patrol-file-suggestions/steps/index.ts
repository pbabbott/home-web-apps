import type { Step } from '../../pipeline';
import type { PawPatrolFileSuggestionsContext } from '../context';
import { checkExistingSuggestions } from './check-existing-suggestions';
import { fetchSonarrEpisodes } from './fetch-sonarr-episodes';
import { hashEpisodeFiles } from './hash-episode-files';
import { listSeasonFiles } from './list-season-files';
import { loadTitleCards } from './load-title-cards';
import { saveSuggestions } from './save-suggestions';
import { suggestFilenames } from './suggest-filenames';

/** Ordered pipeline for the paw_patrol_file_suggestions operation — one step per file in this directory. */
export const steps: Step<PawPatrolFileSuggestionsContext>[] = [
  listSeasonFiles,
  hashEpisodeFiles,
  checkExistingSuggestions,
  loadTitleCards,
  fetchSonarrEpisodes,
  suggestFilenames,
  saveSuggestions,
];
