/**
 * Public prop surface for the ASUSTOR NAS model. Deliberately decoupled from
 * any real telemetry source — `bays` is supplied by the caller (today, mock
 * data from NasViewerClient; eventually, real homelab-api host/drive data).
 */

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
}
