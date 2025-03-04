import { DockerBuildConfig } from './AbctlConfig';
import { config } from './config-loader';

export type DockerBuildPreset = '' | 'default' | 'pnpm-turbo-docker-build';

export const getBuildConfigFromPresetName = (
  presetName: string,
): DockerBuildConfig => {
  const preset = presetName as DockerBuildPreset;

  switch (preset) {
    case 'default':
    case '':
      return {
        baseImage: '',
        context: '.',
        dockerfile: './Dockerfile',
        platform: 'linux/amd64,linux/arm64',
      };
    case 'pnpm-turbo-docker-build':
      const { repository } = config;
      return {
        baseImage: `${repository}/node-22-alpine:1.0.0`,
        context: '../../',
        dockerfile: '../../docker/pnpm-turbo.Dockerfile',
        platform: 'linux/amd64,linux/arm64',
      };
    default:
      throw new Error(`Unknown build preset: ${presetName}`);
  }
};
export const getMergedBuildConfig = (
  userBuildConfig: DockerBuildConfig,
  presetBuildConfig: DockerBuildConfig,
) => {
  const result = new DockerBuildConfig();
  Object.entries(userBuildConfig).forEach(([k, value]) => {
    const key = k as keyof DockerBuildConfig;
    // If a user specified anything other than '', then use it to override the preset values
    result[key] = value === '' ? presetBuildConfig[key] : value;
  });
  return result;
};
