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

export class ApplicationConfig {
  @EnvironmentVariable({ variableType: EnvironmentVariableType.NUMBER })
  port: number = 4002;

  /** Base URL of the OpenAI-compatible AI API server (LM Studio-style) that video-worker also targets. No path — endpoints are appended by the client. Used only to report online/model status to home-hud, not to make chat-completion requests. */
  @EnvironmentVariable()
  aiApiUrl: string = 'http://192.168.5.142:1234';

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

export const validateConfig = () => {
  const statuses = getEnvConfigStatus(defaultConfig);

  console.log('⚙️  video-api environment variables');
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
