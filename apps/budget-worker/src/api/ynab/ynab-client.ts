import { config } from '../../config';

export type YnabResponse = {
  status: number;
  /** The parsed JSON body, exactly as YNAB returned it. */
  body: unknown;
  /** `data.server_knowledge` when the endpoint supports delta requests. */
  serverKnowledge: number | null;
  /** Parsed from the `X-Rate-Limit` header (e.g. `36/200`), if present. */
  rateLimit: { used: number; total: number } | null;
};

/** Non-2xx response from YNAB. 429 means the hourly request budget is spent. */
export class YnabApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'YnabApiError';
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

export const parseRateLimit = (
  header: string | null,
): YnabResponse['rateLimit'] => {
  const match = header?.match(/^(\d+)\/(\d+)$/);

  return match ? { used: Number(match[1]), total: Number(match[2]) } : null;
};

const extractServerKnowledge = (body: unknown): number | null => {
  const value = (body as { data?: { server_knowledge?: unknown } } | null)?.data
    ?.server_knowledge;

  return typeof value === 'number' ? value : null;
};

/**
 * GET against the YNAB API. Pass `lastKnowledge` to make it a delta request
 * (only entities changed since that server_knowledge are returned). The
 * token is only ever sent as a header and never logged.
 */
export const ynabGet = async (
  path: string,
  options: { lastKnowledge?: number | null } = {},
): Promise<YnabResponse> => {
  const url = new URL(`${config.ynab.apiUrl}${path}`);

  if (options.lastKnowledge != null) {
    url.searchParams.set(
      'last_knowledge_of_server',
      String(options.lastKnowledge),
    );
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${config.ynab.apiToken}` },
  });

  if (!response.ok) {
    throw new YnabApiError(
      response.status,
      `YNAB API request failed: ${response.status} ${path}`,
    );
  }

  const body: unknown = await response.json();

  return {
    status: response.status,
    body,
    serverKnowledge: extractServerKnowledge(body),
    rateLimit: parseRateLimit(response.headers.get('X-Rate-Limit')),
  };
};

/**
 * PATCH against the YNAB API with a JSON body. The only write the worker
 * makes; each call counts against the same 200 requests/hour as a GET.
 */
export const ynabPatch = async (
  path: string,
  body: unknown,
): Promise<YnabResponse> => {
  const response = await fetch(new URL(`${config.ynab.apiUrl}${path}`), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${config.ynab.apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new YnabApiError(
      response.status,
      `YNAB API request failed: ${response.status} PATCH ${path}`,
    );
  }

  const parsed: unknown = await response.json();

  return {
    status: response.status,
    body: parsed,
    serverKnowledge: extractServerKnowledge(parsed),
    rateLimit: parseRateLimit(response.headers.get('X-Rate-Limit')),
  };
};
