import { DockerBuildConfig } from '../config/abctl-config';
import { config } from '../config/config-loader';

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
        repository: '',
        tag: '',
        context: '.',
        target: '',
        dockerfile: './Dockerfile',
        platform: 'linux/amd64,linux/arm64',
      };
    case 'pnpm-turbo-docker-build':
      return {
        baseImage: `${config.registryWithNamespace}/node-22-alpine:1.0.0`,
        repository: '',
        tag: '',
        context: '../../',
        target: '',
        dockerfile: '../../docker/pnpm-turbo.Dockerfile',
        platform: 'linux/amd64,linux/arm64',
      };
    default:
      throw new Error(`Unknown build preset: ${presetName}`);
  }
};
