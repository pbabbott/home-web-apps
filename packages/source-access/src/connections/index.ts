import type { SourceConnectionType } from '@abbottland/homelab-db';
import { smbDriver } from './smb';
import type { ConnectionDriver } from './types';

export * from './types';

const DRIVERS: Record<SourceConnectionType, ConnectionDriver> = {
  smb: smbDriver,
};

export const getConnectionDriver = (
  type: SourceConnectionType,
): ConnectionDriver => DRIVERS[type];
