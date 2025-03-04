import {
  getBuildConfigFromPresetName,
  getMergedBuildConfig,
} from './build-presets';
import { DockerBuildConfig } from './abctl-config';

// jest.spyOn(global.console, 'log');

describe('@abbottland/abctl/build-presets getMergedBuildConfig', () => {
  const presetConfig = getBuildConfigFromPresetName('');
  const userConfig: DockerBuildConfig = {
    baseImage: '',
    context: '',
    dockerfile: './custom.Dockerfile',
    platform: 'linux/arm64',
  };

  const sut = getMergedBuildConfig(userConfig, presetConfig);

  it('Should use base image from preset', () => {
    expect(sut.baseImage).toBe(presetConfig.baseImage);
  });
  it('Should use context from preset', () => {
    expect(sut.context).toBe(presetConfig.context);
  });
  it('Should use dockerfile from userConfig', () => {
    expect(sut.dockerfile).toBe(userConfig.dockerfile);
  });
  it('Should use platform from userConfig', () => {
    expect(sut.platform).toBe(userConfig.platform);
  });
});
