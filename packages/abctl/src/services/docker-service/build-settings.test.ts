import { ProjectMetadata } from '../project';
import { makeBuildSettings } from './build-settings';

// jest.spyOn(global.console, 'log');

describe('@abbottland/abctl/build-settings makeBuildSettings', () => {
  const image = 'one_cool_image';
  const dockerBuildConfig = {
    baseImage: 'node:22-alpine',
    context: '../../',
    dockerfile: '../../docker/pnpm-turbo.Dockerfile',
    platform: 'linux/arm64',
  };
  const projectMetadata: ProjectMetadata = {
    parentDirName: 'apps',
    projectName: 'one-cool-app',
    version: '99.0.1',
  };
  const sut = makeBuildSettings(image, dockerBuildConfig, projectMetadata);

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
  it('should set build args', () => {
    expect(sut.buildArgs).toEqual({
      BASE_IMAGE: dockerBuildConfig.baseImage,
      PROJECT_DIR: `${projectMetadata.parentDirName}/`,
      PROJECT: projectMetadata.projectName,
    });
  });
});
