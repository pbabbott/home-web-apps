import { config } from '../../config';

const MODELS_PATH = '/v1/models';
const REQUEST_TIMEOUT_MS = 3000;

type ModelsResponse = {
  data: { id: string }[];
};

export type AiStatus =
  | { online: true; models: string[] }
  | { online: false; models: [] };

/**
 * Checks whether the configured OpenAI-compatible AI API server (aiApiUrl,
 * an LM Studio-style local server on a home LAN box) is reachable, and
 * lists the models it currently has loaded. Unlike video-worker's
 * chatCompletion, this makes a single attempt with a short timeout instead
 * of retrying — it's a status probe for a UI indicator, so "offline" needs
 * to surface quickly rather than block a page load on backoff retries.
 */
export const getAiStatus = async (): Promise<AiStatus> => {
  const url = `${config.aiApiUrl}${MODELS_PATH}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      return { online: false, models: [] };
    }

    const data = (await response.json()) as ModelsResponse;

    return { online: true, models: data.data.map((model) => model.id) };
  } catch {
    return { online: false, models: [] };
  }
};
