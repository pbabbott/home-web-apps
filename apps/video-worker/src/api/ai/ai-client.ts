import { config } from '../../config';

const CHAT_COMPLETIONS_PATH = '/v1/chat/completions';

export type ChatMessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatMessageContentPart[];
};

export type ChatCompletionRequest = {
  model: string;
  messages: ChatMessage[];
};

type ChatCompletionResponse = {
  choices: { message: { content: string } }[];
};

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const sendChatCompletionRequest = async (
  url: string,
  request: ChatCompletionRequest,
): Promise<string> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(
      `AI API request failed: ${response.status} ${await response.text()}`,
    );
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices[0]?.message.content;

  if (!content) {
    throw new Error('AI API response had no message content');
  }

  return content;
};

/**
 * Sends a chat completion request to the configured OpenAI-compatible AI
 * API server (aiApiUrl, an LM Studio-style local server) and returns the
 * first choice's raw message content. Response-shape-agnostic on purpose —
 * callers that expect a particular JSON shape back (per their own system
 * prompt) parse the returned string themselves.
 *
 * Retries up to MAX_ATTEMPTS times with a linear backoff: aiApiUrl is a
 * home LAN box on a separate subnet from the cluster, and transient
 * connect timeouts there shouldn't fail an entire job — detectTitleCard
 * caches per-screenshot responses, so a mid-job failure only costs the one
 * in-flight request, not the whole batch, but retrying here avoids losing
 * even that.
 */
export const chatCompletion = async (
  request: ChatCompletionRequest,
): Promise<string> => {
  const url = `${config.aiApiUrl}${CHAT_COMPLETIONS_PATH}`;

  console.log(`🤖 POST ${url} ${request.model}`);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await sendChatCompletionRequest(url, request);
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) throw err;

      console.warn(
        `⚠️  AI API request failed (attempt ${attempt}/${MAX_ATTEMPTS}), retrying: ${err instanceof Error ? err.message : err}`,
      );
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  throw new Error('unreachable');
};
