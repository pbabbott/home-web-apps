import type { DriveBayStatus } from './types';

/**
 * Maps a bay's status to an emissive accent color, mirroring the
 * STATUS_BADGE_COLOR pattern used by HostsClient/InfraMapClient for 2D
 * status chips.
 */
export const BAY_STATUS_COLOR: Record<DriveBayStatus, string> = {
  empty: '#3D4A4F',
  idle: '#8DABB5',
  active: '#02FBFF',
  warning: '#FAA539',
  error: '#D24F5E',
};
