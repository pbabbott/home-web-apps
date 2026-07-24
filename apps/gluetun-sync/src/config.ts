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
import cron from 'node-cron';

export class ApplicationConfig {
  @EnvironmentVariable({ variableType: EnvironmentVariableType.NUMBER })
  port: number = 4000;

  @EnvironmentVariable()
  cronExpression = '*/2 * * * *';

  @EnvironmentVariable({
    variableName: 'TZ',
    variableType: EnvironmentVariableType.STRING,
  })
  TZ = 'America/Chicago';

  @ConfigSection({ sectionPrefix: 'GLUETUN' })
  gluetun = new GluetunConfig();

  @ConfigSection({ sectionPrefix: 'QBITTORRENT' })
  qbitTorrent = new QbitTorrentConfig();
}

export class GluetunConfig {
  @EnvironmentVariable()
  apiHost: string = '';
}

export class QbitTorrentConfig {
  @EnvironmentVariable()
  apiHost: string = '';

  @EnvironmentVariable()
  username: string = '';

  @EnvironmentVariable()
  password: string = '';
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

  console.log('⚙️  gluetun-sync environment variables');
  formatEnvConfigStatus(statuses).forEach((line) => console.log(`  ${line}`));

  const errors: string[] = statuses
    .filter((status) => status.isMissing)
    .map((status) => status.envVarName);

  if (!cron.validate(config.cronExpression))
    errors.push('cronExpression is not valid');

  if (errors.length) {
    errors.map((x) => {
      console.error('❌ Missing/invalid config variable: ' + x);
    });
    errorExit();
  }
};
