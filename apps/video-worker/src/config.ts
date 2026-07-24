import fs from 'fs';
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

  /** Absolute path video-worker resolves job input/output paths against. Job inputPath/outputPaths are always relative to, and constrained within, this directory. */
  @EnvironmentVariable()
  mediaRoot: string = '';

  /** How often (ms) an idle worker polls for a pending job. */
  @EnvironmentVariable({ variableType: EnvironmentVariableType.NUMBER })
  pollIntervalMs: number = 5000;

  /** Path/binary name used to invoke ffmpeg. Must be on PATH in the container. */
  @EnvironmentVariable()
  ffmpegPath: string = 'ffmpeg';

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

  console.log('⚙️  video-worker environment variables');
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

  if (
    !fs.existsSync(config.mediaRoot) ||
    !fs.statSync(config.mediaRoot).isDirectory()
  ) {
    console.error(
      `❌ MEDIA_ROOT does not exist or is not a directory: ${config.mediaRoot}`,
    );
    errorExit();
  }
};
