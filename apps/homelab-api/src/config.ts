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
  port: number = 4003;

  /** Base URL of the kube-prometheus-stack Prometheus instance used to enrich Kubernetes data with live CPU/memory usage. No path — endpoints are appended by the client. */
  @EnvironmentVariable()
  prometheusUrl: string = 'https://prometheus.local.abbottland.io';

  /** Window (seconds) passed to Prometheus `rate()` queries for CPU usage. */
  @EnvironmentVariable({ variableType: EnvironmentVariableType.NUMBER })
  prometheusQueryWindowSeconds: number = 300;

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

  console.log('⚙️  homelab-api environment variables');
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
