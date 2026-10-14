import type { BayState } from './types';

/**
 * Mock drive-bay data — not real NAS telemetry. Shared by the standalone
 * /infra/viz/nas dev viewer and the /infra/hosts detail-panel embed so
 * both show the same bays instead of two independently-maintained lists.
 * Once a real data source exists, a caller supplies `bays` instead (see
 * NasModelProps in types.ts).
 */
export const MOCK_NAS_BAYS: BayState[] = [
  { id: 'bay-1', label: 'Bay 1', status: 'active', capacityRatio: 0.72 },
  { id: 'bay-2', label: 'Bay 2', status: 'active', capacityRatio: 0.68 },
  { id: 'bay-3', label: 'Bay 3', status: 'active', capacityRatio: 0.81 },
  { id: 'bay-4', label: 'Bay 4', status: 'idle', capacityRatio: 0.1 },
  { id: 'bay-5', label: 'Bay 5', status: 'empty' },
  { id: 'bay-6', label: 'Bay 6', status: 'empty' },
];
