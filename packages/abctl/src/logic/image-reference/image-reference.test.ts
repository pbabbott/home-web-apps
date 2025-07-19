import { config } from '../../config/config-loader';
import { DockerBuildConfig } from '../../config/abctl-config';
import { getImageWithVersion } from './image-reference';

describe('@abbottland/abctl/docker-build-settings-builder imageReference', () => {
  const projectMetadata = {
    parentDirName: 'apps',
    projectName: 'one-cool-app',
    version: '99.0.1',
  };

  it('should return image with version when repository and tag is specified', () => {
    const dockerBuildConfig: DockerBuildConfig = {
      baseImage: 'node:22-alpine',
      context: '../../',
      dockerfile: '../../docker/pnpm-turbo.Dockerfile',
      platform: 'linux/arm64',
      repository: 'one-cool-app-override',
      tag: 'latest',
      target: 'builder',
      load: 'false',
    };
    const imageWithVersion = getImageWithVersion(
      projectMetadata,
      dockerBuildConfig,
    );
    const { registryWithNamespace } = config;
    expect(imageWithVersion).toBe(
      `${registryWithNamespace}/one-cool-app-override:latest`,
    );
  });

  it('should return image with project version when repository and no tag is specified', () => {
    const dockerBuildConfig: DockerBuildConfig = {
      baseImage: 'node:22-alpine',
      context: '../../',
      dockerfile: '../../docker/pnpm-turbo.Dockerfile',
      platform: 'linux/arm64',
      repository: 'one-cool-app-override',
      tag: '',
      target: 'builder',
      load: 'false',
    };
    const imageWithVersion = getImageWithVersion(
      projectMetadata,
      dockerBuildConfig,
    );
    const { registryWithNamespace } = config;
    expect(imageWithVersion).toBe(
      `${registryWithNamespace}/one-cool-app-override:99.0.1`,
    );
  });
});
