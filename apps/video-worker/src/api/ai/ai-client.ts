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

/**
 * Sends a chat completion request to the configured OpenAI-compatible AI
 * API server (aiApiUrl, an LM Studio-style local server) and returns the
 * first choice's raw message content. Response-shape-agnostic on purpose —
 * callers that expect a particular JSON shape back (per their own system
 * prompt) parse the returned string themselves.
 */
export const chatCompletion = async (
  request: ChatCompletionRequest,
): Promise<string> => {
  const url = `${config.aiApiUrl}${CHAT_COMPLETIONS_PATH}`;

  console.log(`🤖 POST ${url} ${request.model}`);

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
