import type { BadgeColor } from '@abbottland/fui-components';
import type { DiscoveryJobStatus } from '../sources/lib/homelab-api';

export const JOB_STATUS_COLOR: Record<DiscoveryJobStatus, BadgeColor> = {
  pending: 'warning',
  running: 'secondary',
  completed: 'success',
  failed: 'error',
  cancelled: 'dark',
};

/**
 * Date and time in UTC (column headers say so), formatted by hand so server
 * and client renders match. No trailing "Z": the pixel font draws it like a
 * digit.
 */
export function formatDateTime(iso: string | null): string {
  return iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}` : '—';
}
