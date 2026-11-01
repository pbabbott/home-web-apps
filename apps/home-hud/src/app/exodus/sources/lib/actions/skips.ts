'use server';

import type { SkipAcknowledgement } from '../homelab-api';
import { type ActionResult, send, post } from './request';

export interface SkipInput {
  path: string;
  /** Set for a "skipped by pattern" entry; `path` is then the directory. */
  pattern?: string;
}

/** A human agrees with the agent's skip. Sent as the default (human) actor. */
export async function acknowledgeSkip(
  queueItemId: string,
  input: SkipInput,
): Promise<ActionResult<SkipAcknowledgement>> {
  return post<SkipAcknowledgement>(
    `/queue-items/${queueItemId}/skip-acknowledgements`,
    input,
  );
}

/** Takes an acknowledgement back. */
export async function unacknowledgeSkip(
  queueItemId: string,
  input: SkipInput,
): Promise<ActionResult> {
  return send(
    'DELETE',
    `/queue-items/${queueItemId}/skip-acknowledgements`,
    input,
  );
}
