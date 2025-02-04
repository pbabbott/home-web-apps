import { getForwardedPort } from '../api/gluetun/gluetun';
import {
  getApplicationPreferences,
  login,
  setApplicationPreference,
} from '../api/qbittorrent';
import { logAttempt, logFailure, logSuccess, SyncCaller } from '../data';

const logLocation = 'services:sync';

const log = (message: string) => {
  console.log(`${logLocation} ${message}`);
};

export type SyncResult = {
  success: boolean;
  validationMessage: string;
};

const failure = (message: string): SyncResult => {
  logFailure(message);
  return { success: false, validationMessage: message };
};

const success = (message: string): SyncResult => {
  logSuccess();
  return { success: true, validationMessage: message };
};
export const syncPorts = async (
  callerIdentity: SyncCaller,
): Promise<SyncResult> => {
  try {
    // Log the attempt in the DB
    logAttempt(callerIdentity);

    // Get Gluetun port
    log('Getting port from gluetun...');
    const gluetunPort = await getForwardedPort();
    if (gluetunPort === null) return failure('Could not get port from gluetun');
    log(`Found gluetun port: ${gluetunPort?.port}`);

    // Login to QbitTorrent
    log('Logging into QbitTorrent...');
    const qbitTorrentLoginResult = await login();
    if (qbitTorrentLoginResult === null)
      return failure('Could not log into qbittorrent');

    // Get Qbit preferences
    log('Getting port from QbitTorrent...');
    const preferences = await getApplicationPreferences(qbitTorrentLoginResult);
    if (preferences === null)
      return failure('Could not get perferences from qbittorrent');

    // Sync
    if (preferences.listen_port === gluetunPort.port)
      return success(
        `QBITTORRENT port and Gluetun port are already in sync: ${preferences.listen_port}`,
      );

    log(
      `Time to sync, ports don't match. QBIT:${preferences.listen_port}, Gluetun:${gluetunPort.port}`,
    );
    const updateResult = await setApplicationPreference(
      qbitTorrentLoginResult,
      'listen_port',
      gluetunPort.port.toString(),
    );

    if (updateResult === null) return failure('Could not set app preferences');
    if (updateResult.status !== 200)
      return failure(
        `Could not update preferences status=${updateResult.status}, statusText=${updateResult.statusText}`,
      );

    return success('Sync process completed successfully');
  } catch (err) {
    return {
      success: false,
      validationMessage: err as string,
    };
  }
};
