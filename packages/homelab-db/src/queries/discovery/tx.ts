import type { Database } from '../../client';

export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
