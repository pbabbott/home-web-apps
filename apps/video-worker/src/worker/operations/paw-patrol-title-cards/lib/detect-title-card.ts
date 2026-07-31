import {
  getAiResponseCache,
  upsertAiResponseCache,
} from '@abbottland/video-db';
import {
  chatCompletion,
  parseJsonResponse,
  type ChatCompletionRequest,
} from '../../../../api/ai/ai-client';
import { db } from '../../../../db';

const SYSTEM_PROMPT =
  'You extract text from images. Respond with valid JSON only, no other text.';

const USER_PROMPT =
  'Look at this image. If it shows a Paw Patrol episode title (large stylized text on screen), return {"found": true, "title": "the exact title text"}. If no title is visible, return {"found": false}.';

export type TitleCardDetectionResult =
  | { found: true; title: string }
  | { found: false };

export type TitleCardDetection = TitleCardDetectionResult & {
  screenshotPath: string;
  screenshotBase64: string;
  timestampSeconds: number;
};

/**
 * Asks the AI API (via the generic chatCompletion client) whether the
 * screenshot at `screenshotPath` shows a Paw Patrol title card, caching
 * the response (keyed on screenshotPath + model, ai_response_cache table)
 * since a real call is expensive — a screenshot already asked about with
 * the configured model is served from the cache on every later run. The
 * model is instructed to respond with JSON only, so the response content
 * is parsed directly as TitleCardDetectionResult — a malformed response
 * surfaces as a thrown parse error rather than a silently wrong result.
 */
export const detectTitleCard = async (
  screenshotPath: string,
  imageBase64: string,
  mimeType: string,
  model: string,
): Promise<TitleCardDetectionResult> => {
  const cached = await getAiResponseCache(db, screenshotPath, model);

  if (cached) {
    return cached.response as TitleCardDetectionResult;
  }

  const request: ChatCompletionRequest = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: USER_PROMPT },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${imageBase64}` },
          },
        ],
      },
    ],
  };

  const content = await chatCompletion(request);
  const result = parseJsonResponse<TitleCardDetectionResult>(request, content);

  await upsertAiResponseCache(db, {
    screenshotPath,
    model,
    response: result,
  });

  return result;
};
