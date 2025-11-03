import {DockerBuildConfig} from '../../config/abctl-config.js'
import {getBuildConfigFromPresetName} from '../build-presets.js'
import {getMergedBuildConfig} from './build-config-merger.js'

// jest.spyOn(global.console, 'log');

describe('@abbottland/abctl/build-config-merger getMergedBuildConfig', () => {
  const presetConfig = getBuildConfigFromPresetName('')
  const userConfig: DockerBuildConfig = {
    repository: '',
    tag: '',
    baseImage: '',
    context: '',
    load: '',
    target: '',
    dockerfile: './custom.Dockerfile',
    platform: 'linux/arm64',
  }

  const sut = getMergedBuildConfig(userConfig, presetConfig)

  it('Should use base image from preset', () => {
    expect(sut.baseImage).toBe(presetConfig.baseImage)
  })
  it('Should use context from preset', () => {
    expect(sut.context).toBe(presetConfig.context)
  })
  it('Should use dockerfile from userConfig', () => {
    expect(sut.dockerfile).toBe(userConfig.dockerfile)
  })
  it('Should use platform from userConfig', () => {
    expect(sut.platform).toBe(userConfig.platform)
  })
})
