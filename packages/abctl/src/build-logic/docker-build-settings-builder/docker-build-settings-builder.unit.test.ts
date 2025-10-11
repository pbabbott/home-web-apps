import { DockerBuildConfig } from '../../config/abctl-config';
import { ProjectMetadata } from '../project-metadata';
import { makeBuildSettings } from './docker-build-settings-builder';

describe('@abbottland/abctl/docker-build-settings-builder makeBuildSettings', () => {
  const image = 'one_cool_image';

  const dockerBuildConfig: DockerBuildConfig = {
    baseImage: 'node:22-alpine',
    context: '../../',
    dockerfile: '../../docker/pnpm-turbo.Dockerfile',
    platform: 'linux/arm64',
    repository: 'one-cool-app',
    load: 'false',
    tag: 'latest',
    target: 'builder',
  };
  const projectMetadata: ProjectMetadata = {
    parentDirName: 'apps',
    projectName: 'one-cool-app',
    version: '99.0.1',
  };
  const sut = makeBuildSettings(image, dockerBuildConfig, projectMetadata);

  // TODO: Add tests for the build settings
  it('should set image', () => {
    expect(sut.image).toBe(image);
  });
  it('should set context', () => {
    expect(sut.context).toBe(dockerBuildConfig.context);
  });
  it('should set dockerfile', () => {
    expect(sut.dockerfile).toBe(dockerBuildConfig.dockerfile);
  });
  it('should set platform', () => {
    expect(sut.platform).toBe(dockerBuildConfig.platform);
  });
  it('should set target', () => {
    expect(sut.target).toBe(dockerBuildConfig.target);
  });
  it('should set build args', () => {
    expect(sut.buildArgs).toEqual({
      BASE_IMAGE: dockerBuildConfig.baseImage,
      PROJECT_DIR: `${projectMetadata.parentDirName}/`,
      PROJECT: projectMetadata.projectName,
    });
  });
});
