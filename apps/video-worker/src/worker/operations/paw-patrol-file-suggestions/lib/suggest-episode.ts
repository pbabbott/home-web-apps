import { chatCompletion } from '../../../../api/ai/ai-client';
import type { SonarrEpisode } from '../../../../api/sonarr/sonarr-client';
import { config } from '../../../../config';

const SYSTEM_PROMPT =
  'You match a video file to its official episode. Respond with valid JSON only, no other text.';

export type EpisodeMatchResult =
  | { found: true; episodeNumber: number; episodeTitle: string }
  | { found: false };

const buildUserPrompt = (
  filename: string,
  titleCardTitles: string[],
  sonarrEpisodes: SonarrEpisode[],
): string =>
  [
    `File name: ${filename}`,
    `Title text detected on-screen in this file: ${
      titleCardTitles.length ? titleCardTitles.join(', ') : '(none detected)'
    }`,
    'Official episode list for this season:',
    ...sonarrEpisodes.map(
      (episode) => `  E${episode.episodeNumber}: ${episode.title}`,
    ),
    'Which official episode does this file match? Return {"found": true, "episodeNumber": N, "episodeTitle": "the exact official title"}. If you cannot confidently match one, return {"found": false}.',
  ].join('\n');

/**
 * Asks the AI (via the generic chatCompletion client) to match an episode
 * file to one of Sonarr's official episodes, using the file's detected
 * title-card text as evidence. Not cached — unlike title-card detection
 * (one call per screenshot, cheap to re-ask), this job's idempotency
 * already comes from the file_renames existence check upstream, so a
 * second cache layer here would be redundant.
 */
export const suggestEpisode = async (
  filename: string,
  titleCardTitles: string[],
  sonarrEpisodes: SonarrEpisode[],
): Promise<EpisodeMatchResult> => {
  const content = await chatCompletion({
    model: config.aiModel,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: buildUserPrompt(filename, titleCardTitles, sonarrEpisodes),
      },
    ],
  });

  return JSON.parse(content) as EpisodeMatchResult;
};
