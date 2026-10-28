import type { Host, SourceConnection } from '@abbottland/homelab-db';
import type { ConnectionTarget } from './connections';
import { decryptSecret } from './secret-box';

/** Builds the target a driver needs from a connection row and its linked host. */
export const buildConnectionTarget = (
  connection: Pick<
    SourceConnection,
    'username' | 'domain' | 'secretCiphertext' | 'settings'
  >,
  host: Pick<Host, 'ipAddress' | 'name'>,
): ConnectionTarget => ({
  address: host.ipAddress,
  hostNames: [host.ipAddress, host.name],
  username: connection.username,
  domain: connection.domain,
  password: decryptSecret(connection.secretCiphertext),
  settings: connection.settings,
});
