import {
  chatCompletion,
  parseJsonResponse,
  type ChatCompletionRequest,
} from '../../../../api/ai/ai-client';
import type { SonarrEpisode } from '../../../../api/sonarr/sonarr-client';

const SYSTEM_PROMPT = `You are a TV episode identification specialist for a Paw Patrol media library. Your only job is matching ONE video file — which shows exactly one detected on-screen title card — to its single official episode from Sonarr.

Matching rules:
- The detected title-card text is OCR'd from a screenshot and may have typos, missing punctuation, extra whitespace, or a slightly different word order than the official title. Match on meaning, not exact string equality.
- The detected text must correspond to the SAME episode, not just a similar-sounding or thematically related one. "Pups Save a Goldfish" and "Pups Save a Goldrush" are different episodes even though they look alike.
- If the detected text is empty, garbled, or doesn't clearly correspond to exactly one entry in the official list, you do not have enough evidence — do not guess.

Respond with valid JSON only: no markdown, no code fences, no explanation, no other text.`;

const buildUserPrompt = (
  filename: string,
  titleCardTitle: string,
  sonarrEpisodes: SonarrEpisode[],
): string =>
  [
    `File name: ${filename}`,
    `Title card text detected on-screen in this file: ${titleCardTitle || '(none detected)'}`,
    '',
    'Official episode list for this season (from Sonarr):',
    ...sonarrEpisodes.map(
      (episode) => `  E${episode.episodeNumber}: ${episode.title}`,
    ),
    '',
    'Return the single official episode this file matches as:',
    '{"found": true, "episodeNumber": <N>, "episodeTitle": "<exact official title from the list above>"}',
    'If you cannot confidently match exactly one episode, return:',
    '{"found": false}',
  ].join('\n');

export type SingleEpisodeMatchResult =
  | { found: true; episodeNumber: number; episodeTitle: string }
  | { found: false };

/**
 * Asks the AI to match a file with one detected title card to its single
 * official Sonarr episode. Not cached — this job's idempotency already
 * comes from the file_renames existence check upstream, so a second cache
 * layer here would be redundant. See suggestDoubleEpisode for the
 * two-title-cards-in-one-file case, which needs a differently targeted
 * prompt rather than a generalized "1 or more" version of this one.
 */
export const suggestSingleEpisode = async (
  filename: string,
  titleCardTitle: string,
  sonarrEpisodes: SonarrEpisode[],
  model: string,
): Promise<SingleEpisodeMatchResult> => {
  const request: ChatCompletionRequest = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: buildUserPrompt(filename, titleCardTitle, sonarrEpisodes),
      },
    ],
  };

  const content = await chatCompletion(request);
  return parseJsonResponse<SingleEpisodeMatchResult>(request, content);
};
