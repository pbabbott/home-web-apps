import * as dotenv from 'dotenv';
import {
  ConfigSection,
  EnvironmentVariable,
  EnvironmentVariableType,
  loadConfig,
} from '@abbottland/yaml-config';
import { errorExit } from './process';
import cron from 'node-cron';

export class ApplicationConfig {
  @EnvironmentVariable({ variableType: EnvironmentVariableType.NUMBER })
  port: number = 4000;

  @EnvironmentVariable({ variableType: EnvironmentVariableType.BOOLEAN })
  showConfig: boolean = false;

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

export const initConfig = async () => {
  dotenv.config();

  const defaultConfig = new ApplicationConfig();
  config = await loadConfig(defaultConfig);

  if (config.showConfig) {
    console.log('config', config);
  }
};

export const validateConfig = () => {
  const errors: string[] = [];

  if (config.gluetun.apiHost === '') errors.push('gluetun.apiHost');
  if (config.qbitTorrent.apiHost === '') errors.push('qbitTorrent.apiHost');
  if (config.qbitTorrent.username === '') errors.push('qbitTorrent.username');
  if (config.qbitTorrent.password === '') errors.push('qbitTorrent.password');
  if (config.cronExpression === '') errors.push('cronExpression is required');
  if (!cron.validate(config.cronExpression))
    errors.push('cronExpression is not valid');

  if (config.TZ === '') errors.push('TZ is required');

  if (errors.length) {
    errors.map((x) => {
      console.error('Missing config variable: ' + x);
    });
    errorExit();
  }
};
