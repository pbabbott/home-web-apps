import {
  chatCompletion,
  parseJsonResponse,
  type ChatCompletionRequest,
} from '../../../../api/ai/ai-client';
import type { SonarrEpisode } from '../../../../api/sonarr/sonarr-client';

const SYSTEM_PROMPT = `You are a TV episode identification specialist for a Paw Patrol media library. Your only job is matching ONE video file that bundles TWO back-to-back episodes — a common release pattern for this show — to its two official episodes from Sonarr.

You will be given two detected on-screen title cards, in the chronological order they appear in the file (first segment, then second segment). Match each one to its own official episode.

Matching rules:
- The detected title-card text is OCR'd from a screenshot and may have typos, missing punctuation, extra whitespace, or a slightly different word order than the official title. Match on meaning, not exact string equality.
- The two episodes are usually adjacent numbers (e.g. E18 and E19), but do not assume this — confirm each match independently against the title text, and never force adjacency if the titles clearly point elsewhere.
- The two episodes must be DIFFERENT episodes. Never return the same episode number twice.
- Preserve file order: "episodes[0]" must correspond to the FIRST title card given (the earlier segment), and "episodes[1]" to the SECOND.
- If either segment's text is empty, garbled, or doesn't clearly correspond to exactly one entry in the official list, you do not have enough evidence for a confident match on the whole file — do not guess.

Respond with valid JSON only: no markdown, no code fences, no explanation, no other text.`;

const buildUserPrompt = (
  filename: string,
  firstTitleCardTitle: string,
  secondTitleCardTitle: string,
  sonarrEpisodes: SonarrEpisode[],
): string =>
  [
    `File name: ${filename}`,
    `First title card text detected on-screen (earlier segment): ${firstTitleCardTitle || '(none detected)'}`,
    `Second title card text detected on-screen (later segment): ${secondTitleCardTitle || '(none detected)'}`,
    '',
    'Official episode list for this season (from Sonarr):',
    ...sonarrEpisodes.map(
      (episode) => `  E${episode.episodeNumber}: ${episode.title}`,
    ),
    '',
    'Return the two official episodes this file matches, in file order, as:',
    '{"found": true, "episodes": [{"episodeNumber": <N1>, "episodeTitle": "<exact official title>"}, {"episodeNumber": <N2>, "episodeTitle": "<exact official title>"}]}',
    'If you cannot confidently match both distinct episodes, return:',
    '{"found": false}',
  ].join('\n');

type EpisodeMatch = { episodeNumber: number; episodeTitle: string };

export type DoubleEpisodeMatchResult =
  | { found: true; episodes: [EpisodeMatch, EpisodeMatch] }
  | { found: false };

/**
 * Asks the AI to match a file with two detected title cards (a bundled
 * two-episode file, e.g. two Paw Patrol shorts in one video) to its two
 * official Sonarr episodes, in file order. A dedicated prompt rather than
 * a generalized "N title cards" version of suggestSingleEpisode — the
 * ordering requirement and distinct-episode constraint are specific enough
 * to the two-episode case to warrant their own targeted instructions. Not
 * cached, for the same reason as suggestSingleEpisode.
 */
export const suggestDoubleEpisode = async (
  filename: string,
  firstTitleCardTitle: string,
  secondTitleCardTitle: string,
  sonarrEpisodes: SonarrEpisode[],
  model: string,
): Promise<DoubleEpisodeMatchResult> => {
  const request: ChatCompletionRequest = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: buildUserPrompt(
          filename,
          firstTitleCardTitle,
          secondTitleCardTitle,
          sonarrEpisodes,
        ),
      },
    ],
  };

  const content = await chatCompletion(request);
  return parseJsonResponse<DoubleEpisodeMatchResult>(request, content);
};
