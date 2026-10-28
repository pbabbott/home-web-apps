import path from 'path';
import * as dotenv from 'dotenv';
import {
  ConfigSection,
  EnvironmentVariable,
  EnvironmentVariableType,
  formatEnvConfigStatus,
  getEnvConfigStatus,
  loadConfig,
} from '@abbottland/yaml-config';
import { errorExit } from './process';

export class PostgresConfig {
  @EnvironmentVariable()
  host: string = 'localhost';

  @EnvironmentVariable({ variableType: EnvironmentVariableType.NUMBER })
  port: number = 5432;

  @EnvironmentVariable()
  database: string = '';

  @EnvironmentVariable()
  user: string = '';

  @EnvironmentVariable()
  password: string = '';
}

export type MountCheck = 'nfs' | 'none';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ApplicationConfig {
  @EnvironmentVariable({ variableType: EnvironmentVariableType.NUMBER })
  port: number = 4004;

  /** Decrypts the source connection passwords; the same value homelab-api uses. 32 bytes, base64. */
  @EnvironmentVariable()
  exodusCredentialKey: string = '';

  /** The backup destination (`backup_destinations.id`) this worker serves. */
  @EnvironmentVariable()
  backupDestinationId: string = '';

  /** Container path of the mounted export (local development: a scratch directory). */
  @EnvironmentVariable()
  backupDestinationPath: string = '';

  /** `nfs` verifies the mount in /proc/mounts. `none` is for local development only and is recorded as `mountVerified: false`. */
  @EnvironmentVariable()
  backupDestinationMountCheck: string = 'nfs';

  /** Files of one item copied at once (used by the copy engine). */
  @EnvironmentVariable({ variableType: EnvironmentVariableType.NUMBER })
  backupParallelism: number = 1;

  /** No-progress timeout for source reads and destination operations. */
  @EnvironmentVariable({ variableType: EnvironmentVariableType.NUMBER })
  backupStallTimeoutSeconds: number = 120;

  /** Heartbeat interval while an item is leased (used by the copy engine). */
  @EnvironmentVariable({ variableType: EnvironmentVariableType.NUMBER })
  backupHeartbeatSeconds: number = 60;

  /** Lease length (used by the copy engine). */
  @EnvironmentVariable({ variableType: EnvironmentVariableType.NUMBER })
  backupLeaseSeconds: number = 300;

  /** How often (ms) the worker polls. The API treats a worker as stale after 2 minutes, so keep this well under that. */
  @EnvironmentVariable({ variableType: EnvironmentVariableType.NUMBER })
  pollIntervalMs: number = 5000;

  @ConfigSection({ sectionPrefix: 'POSTGRES' })
  postgres = new PostgresConfig();
}

export let config: ApplicationConfig;

let defaultConfig: ApplicationConfig;

export const initConfig = async () => {
  dotenv.config();

  defaultConfig = new ApplicationConfig();
  config = await loadConfig(defaultConfig);
};

/** Problems with the loaded values, as messages. Pure so it can be unit tested. */
export const findConfigProblems = (cfg: ApplicationConfig): string[] => {
  const problems: string[] = [];

  if (!UUID_PATTERN.test(cfg.backupDestinationId)) {
    problems.push('BACKUP_DESTINATION_ID must be a UUID');
  }

  if (!path.isAbsolute(cfg.backupDestinationPath)) {
    problems.push('BACKUP_DESTINATION_PATH must be an absolute path');
  }

  if (!['nfs', 'none'].includes(cfg.backupDestinationMountCheck)) {
    problems.push('BACKUP_DESTINATION_MOUNT_CHECK must be "nfs" or "none"');
  }

  if (Buffer.from(cfg.exodusCredentialKey, 'base64').length !== 32) {
    problems.push(
      'EXODUS_CREDENTIAL_KEY must be 32 bytes, base64 encoded (openssl rand -base64 32)',
    );
  }

  for (const [name, value] of [
    ['BACKUP_PARALLELISM', cfg.backupParallelism],
    ['BACKUP_STALL_TIMEOUT_SECONDS', cfg.backupStallTimeoutSeconds],
    ['BACKUP_HEARTBEAT_SECONDS', cfg.backupHeartbeatSeconds],
    ['BACKUP_LEASE_SECONDS', cfg.backupLeaseSeconds],
    ['POLL_INTERVAL_MS', cfg.pollIntervalMs],
  ] as const) {
    if (!Number.isInteger(value) || value < 1) {
      problems.push(`${name} must be a positive integer`);
    }
  }

  return problems;
};

export const validateConfig = () => {
  const statuses = getEnvConfigStatus(defaultConfig);

  console.log('⚙️  backup-worker environment variables');
  formatEnvConfigStatus(statuses).forEach((line) => console.log(`  ${line}`));

  const missing = statuses.filter((status) => status.isMissing);

  if (missing.length) {
    missing.forEach((status) => {
      console.error(
        `❌ Missing required config variable: ${status.envVarName}`,
      );
    });
    errorExit();
  }

  // The destination path is deliberately not checked for existence here:
  // destination validation reports that, and writes it to the database where
  // the UI can show it.
  const problems = findConfigProblems(config);

  if (problems.length) {
    problems.forEach((problem) => console.error(`❌ ${problem}`));
    errorExit();
  }
};
