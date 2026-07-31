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
const MIN_REQUEST_INTERVAL_MS = 1000;
const MAX_CONCURRENT_REQUESTS = 3;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Rate-gates request starts to one per MIN_REQUEST_INTERVAL_MS, serialized
 * across every concurrent chatCompletion caller (e.g. suggest-filenames.ts's
 * Promise.all over episodes) via a single chained queue — a request only
 * gets its start slot once every prior queued request has taken its own.
 */
let startQueue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

const waitForStartSlot = (): Promise<void> => {
  const slot = startQueue.then(async () => {
    const wait = lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
  });

  startQueue = slot;
  return slot;
};

/**
 * Caps how many requests are in flight at once, independent of the start
 * rate above: aiApiUrl is a single home LAN box, and a slow vision-model
 * response could otherwise let one-per-second starts stack into an
 * unbounded pile of concurrent in-flight requests.
 */
let activeRequests = 0;
const concurrencyWaiters: (() => void)[] = [];

const acquireConcurrencySlot = (): Promise<void> => {
  if (activeRequests < MAX_CONCURRENT_REQUESTS) {
    activeRequests++;
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    concurrencyWaiters.push(() => {
      activeRequests++;
      resolve();
    });
  });
};

const releaseConcurrencySlot = (): void => {
  activeRequests--;
  concurrencyWaiters.shift()?.();
};

const sendChatCompletionRequest = async (
  url: string,
  request: ChatCompletionRequest,
): Promise<string> => {
  await waitForStartSlot();
  await acquireConcurrencySlot();

  try {
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
  } finally {
    releaseConcurrencySlot();
  }
};

const describeMessageContent = (content: ChatMessage['content']): string => {
  if (typeof content === 'string') return content;

  return content
    .map((part) =>
      part.type === 'text'
        ? part.text
        : `[image omitted, ${part.image_url.url.length} chars]`,
    )
    .join('\n');
};

const describeMessages = (messages: ChatMessage[]): string =>
  messages
    .map(
      (message) =>
        `--- ${message.role} ---\n${describeMessageContent(message.content)}`,
    )
    .join('\n\n');

/**
 * Parses an AI response as JSON, dumping the full prompt and raw response to
 * the logs before rethrowing on failure — the model occasionally wraps its
 * JSON in a markdown code fence or adds stray text despite being told not
 * to, and the bare SyntaxError from JSON.parse alone doesn't say what it
 * actually sent back, making that failure mode otherwise undiagnosable
 * after the fact.
 */
export const parseJsonResponse = <T>(
  request: ChatCompletionRequest,
  content: string,
): T => {
  try {
    return JSON.parse(content) as T;
  } catch (err) {
    console.error(
      `❌ AI response was not valid JSON (model=${request.model})\n${describeMessages(request.messages)}\n--- response ---\n${content}`,
    );
    throw err;
  }
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
