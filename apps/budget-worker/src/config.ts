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

export const YNAB_TOKEN_UNSET = 'not-configured';

export class YnabConfig {
  /** Base URL of the YNAB API. Endpoints are appended by the client. */
  @EnvironmentVariable()
  apiUrl: string = 'https://api.ynab.com/v1';

  /**
   * YNAB Personal Access Token. Defaults to a sentinel rather than '' so a
   * missing token does not stop the whole worker at startup (hello jobs and
   * probes still work); ynab_sync fails the job when it is unset.
   */
  @EnvironmentVariable()
  apiToken: string = YNAB_TOKEN_UNSET;
}

export class ApplicationConfig {
  @EnvironmentVariable({ variableType: EnvironmentVariableType.NUMBER })
  port: number = 4006;

  /** How often (ms) an idle worker polls for a pending job. */
  @EnvironmentVariable({ variableType: EnvironmentVariableType.NUMBER })
  pollIntervalMs: number = 5000;

  @ConfigSection({ sectionPrefix: 'POSTGRES' })
  postgres = new PostgresConfig();

  @ConfigSection({ sectionPrefix: 'YNAB' })
  ynab = new YnabConfig();
}

export let config: ApplicationConfig;

let defaultConfig: ApplicationConfig;

export const initConfig = async () => {
  dotenv.config();

  defaultConfig = new ApplicationConfig();
  config = await loadConfig(defaultConfig);
};

export const validateConfig = () => {
  const statuses = getEnvConfigStatus(defaultConfig);

  console.log('⚙️  budget-worker environment variables');
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
};
