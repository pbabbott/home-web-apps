import type { NamedStep } from '../../pipeline';
import type { PawPatrolFileSuggestionsContext } from '../context';
import { checkExistingSuggestions } from './check-existing-suggestions';
import { fetchSonarrEpisodes } from './fetch-sonarr-episodes';
import { hashEpisodeFiles } from './hash-episode-files';
import { listSeasonFiles } from './list-season-files';
import { loadTitleCards } from './load-title-cards';
import { saveSuggestions } from './save-suggestions';
import { suggestFilenames } from './suggest-filenames';

/** Ordered pipeline for the paw_patrol_file_suggestions operation — one step per file in this directory. */
export const steps: NamedStep<PawPatrolFileSuggestionsContext>[] = [
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
    name: 'check-existing-suggestions',
    message: 'Checking existing suggestions',
    run: checkExistingSuggestions,
  },
  {
    name: 'load-title-cards',
    message: 'Loading title cards',
    run: loadTitleCards,
  },
  {
    name: 'fetch-sonarr-episodes',
    message: 'Fetching Sonarr episode list',
    run: fetchSonarrEpisodes,
  },
  {
    name: 'suggest-filenames',
    message: 'Matching episodes to filenames',
    run: suggestFilenames,
  },
  {
    name: 'save-suggestions',
    message: 'Saving file-rename suggestions',
    run: saveSuggestions,
  },
];
