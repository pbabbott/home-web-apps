/**
 * Public prop surface for the ASUSTOR NAS model. Deliberately decoupled from
 * any real telemetry source — `bays` is supplied by the caller (today, mock
 * data from NasViewerClient; eventually, real homelab-api host/drive data).
 */

import type { ModelStatus } from '../../components/resolve-material-colors';

export type DriveBayStatus = 'empty' | 'idle' | 'active' | 'warning' | 'error';

export interface BayState {
  id: string;
  label: string;
  status: DriveBayStatus;
  /** 0-1 fraction full. Omitted (not zero) means "unknown". */
  capacityRatio?: number;
}

export type DeviceHealth = 'healthy' | 'degraded' | 'unknown';

export interface NasModelProps {
  deviceName: string;
  health: DeviceHealth;
  bays: BayState[];
  selectedBayId: string | null;
  hoveredBayId: string | null;
  onSelectBay: (bayId: string) => void;
  onHoverBay: (bayId: string | null) => void;
  /**
   * Overrides every border/line/glow color (`materials.edgeHighlight`) with
   * this hex value. Leave unset to use the model's own default
   * (`config.materials.edgeHighlight`). Ignored when `status` is
   * `'offline'`/`'unknown'` — see `status`.
   */
  edgeColor?: string;
  /**
   * `'online'` (default) respects `edgeColor`/the model's own default;
   * `'offline'`/`'unknown'` override every color (including `edgeColor`)
   * with a shared neutral/secondary tone — see
   * `components/resolve-material-colors.ts`.
   */
  status?: ModelStatus;
}
