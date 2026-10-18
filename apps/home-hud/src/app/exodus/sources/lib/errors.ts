const QUEUE_COUNT_LABELS: [key: string, label: string][] = [
  ['queued', 'queued'],
  ['in_progress', 'in progress'],
];

/**
 * Turns a failed homelab-api response into text for the user. Its 404/409
 * bodies carry a readable `message`; a blocked job completion also carries
 * `queueCounts`, which is appended so the user sees what is still pending.
 */
export async function errorMessage(res: Response): Promise<string> {
  const body = await res.text();

  try {
    const { message, queueCounts, blocked, missingIds } = JSON.parse(body) as {
      message?: string;
      queueCounts?: Record<string, number>;
      blocked?: unknown[];
      missingIds?: unknown[];
    };

    // A bulk review refused because of some of its items.
    if (message && blocked?.length) {
      return `${message} (${blocked.length} of the selected items)`;
    }

    if (message && missingIds?.length) {
      return `${message} (${missingIds.length} no longer exist; refresh the page)`;
    }

    if (message) {
      const pending = queueCounts
        ? QUEUE_COUNT_LABELS.filter(([key]) => queueCounts[key] > 0).map(
            ([key, label]) => `${queueCounts[key]} ${label}`,
          )
        : [];

      return pending.length > 0
        ? `${message} (${pending.join(', ')})`
        : message;
    }
  } catch {
    // Not JSON — fall through to the raw body.
  }

  return `homelab-api returned ${res.status}: ${body}`;
}
