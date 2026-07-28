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

export class SonarrConfig {
  /** Base URL of the Sonarr instance (e.g. http://sonarr.local:8989). No path — endpoints are appended by the client. */
  @EnvironmentVariable()
  apiUrl: string = '';

  /** Sonarr API key, from Settings > General in the Sonarr UI. */
  @EnvironmentVariable()
  apiKey: string = '';
}

export class ApplicationConfig {
  @EnvironmentVariable({ variableType: EnvironmentVariableType.NUMBER })
  port: number = 4003;

  /** Absolute path video-worker resolves job input/output paths against. Job outputPaths are always relative to, and constrained within, this directory. */
  @EnvironmentVariable()
  mediaRoot: string = '';

  /** How often (ms) an idle worker polls for a pending job. */
  @EnvironmentVariable({ variableType: EnvironmentVariableType.NUMBER })
  pollIntervalMs: number = 5000;

  /** Path/binary name used to invoke ffmpeg. Must be on PATH in the container. */
  @EnvironmentVariable()
  ffmpegPath: string = 'ffmpeg';

  /** Path/binary name used to invoke ffprobe (for probing episode runtime). Must be on PATH in the container. */
  @EnvironmentVariable()
  ffprobePath: string = 'ffprobe';

  /** Base URL of the OpenAI-compatible AI API server (LM Studio-style) used to ask a vision model about screenshots. No path — endpoints are appended by the client. */
  @EnvironmentVariable()
  aiApiUrl: string = 'http://192.168.5.142:1234';

  /** Model name to request from aiApiUrl. */
  @EnvironmentVariable()
  aiModel: string = 'qwen/qwen3-vl-8b-instruct';

  @ConfigSection({ sectionPrefix: 'POSTGRES' })
  postgres = new PostgresConfig();

  @ConfigSection({ sectionPrefix: 'SONARR' })
  sonarr = new SonarrConfig();
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
