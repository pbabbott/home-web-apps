import * as dotenv from 'dotenv';
import {
  ConfigSection,
  EnvironmentVariable,
  EnvironmentVariableType,
  loadConfig,
} from '@abbottland/yaml-config';
import { errorExit } from './process';

export class HarborConfig {
  @EnvironmentVariable()
  host: string = '';

  @EnvironmentVariable()
  username: string = '';

  @EnvironmentVariable()
  password: string = '';
}

export class GitHubConfig {
  @EnvironmentVariable()
  token: string = '';

  @EnvironmentVariable()
  owner: string = '';

  @EnvironmentVariable()
  repo: string = '';
}

export class ApplicationConfig {
  @EnvironmentVariable({ variableType: EnvironmentVariableType.NUMBER })
  port: number = 4030;

  @EnvironmentVariable({ variableType: EnvironmentVariableType.BOOLEAN })
  showConfig: boolean = false;

  @EnvironmentVariable()
  cleanupRepositories: string = 'blog';

  @EnvironmentVariable({ variableType: EnvironmentVariableType.NUMBER })
  prodKeepCount: number = 5;

  @ConfigSection({ sectionPrefix: 'HARBOR' })
  harbor = new HarborConfig();

  @ConfigSection({ sectionPrefix: 'GITHUB' })
  gitHub = new GitHubConfig();
}

export let config: ApplicationConfig;

export const initConfig = async () => {
  dotenv.config();
  const defaultConfig = new ApplicationConfig();
  config = await loadConfig(defaultConfig);
  if (config.showConfig) {
    console.log('config', {
      ...config,
      harbor: { ...config.harbor, password: '***' },
      gitHub: { ...config.gitHub, token: '***' },
    });
  }
};

export const validateConfig = () => {
  const errors: string[] = [];

  if (!config.harbor.host) errors.push('HARBOR_HOST');
  if (!config.harbor.username) errors.push('HARBOR_USERNAME');
  if (!config.harbor.password) errors.push('HARBOR_PASSWORD');
  if (!config.gitHub.token) errors.push('GITHUB_TOKEN');
  if (!config.gitHub.owner) errors.push('GITHUB_OWNER');
  if (!config.gitHub.repo) errors.push('GITHUB_REPO');
  if (!config.cleanupRepositories) errors.push('CLEANUP_REPOSITORIES');

  if (errors.length) {
    errors.forEach((x) => console.error('Missing config variable: ' + x));
    errorExit();
  }
};
