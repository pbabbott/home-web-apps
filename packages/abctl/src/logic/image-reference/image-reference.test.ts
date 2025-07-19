import { config } from '../../config/config-loader';
import { DockerBuildConfig } from '../../config/abctl-config';
import { getImageWithVersion } from './image-reference';

describe('@abbottland/abctl/docker-build-settings-builder imageReference', () => {
  const projectMetadata = {
    parentDirName: 'apps',
    projectName: 'one-cool-app',
    version: '99.0.1',
  };

  const dockerBuildConfig: DockerBuildConfig = {
    baseImage: 'node:22-alpine',
    context: '../../',
    dockerfile: '../../docker/pnpm-turbo.Dockerfile',
    platform: 'linux/arm64',
    repository: 'one-cool-app-override',
    tag: 'latest',
    target: 'builder',
  };

  it('should return image with version when repository is specified', () => {
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
