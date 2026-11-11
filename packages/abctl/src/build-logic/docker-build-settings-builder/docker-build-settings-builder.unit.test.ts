import {DockerBuildConfig} from '../../config/abctl-config.js'
import {ProjectMetadata} from '../project-metadata.js'
import {makeBuildSettings} from './docker-build-settings-builder.js'

describe('@abbottland/abctl/docker-build-settings-builder makeBuildSettings', () => {
  const image = 'one_cool_image:20260101-001-abc1234'

  const dockerBuildConfig: DockerBuildConfig = {
    baseImage: 'node:22-alpine',
    context: '../../',
    dockerfile: '../../docker/pnpm-turbo.Dockerfile',
    platform: 'linux/arm64',
    repository: 'one-cool-app',
    load: 'false',
    tag: 'latest',
    target: 'builder',
  }
  const projectMetadata: ProjectMetadata = {
    parentDirName: 'apps',
    projectName: 'one-cool-app',
    version: '99.0.1',
  }

  describe('without buildCache config', () => {
    const sut = makeBuildSettings(image, dockerBuildConfig, projectMetadata)

    it('should set image', () => {
      expect(sut.image).toBe(image)
    })
    it('should set context', () => {
      expect(sut.context).toBe(dockerBuildConfig.context)
    })
    it('should set dockerfile', () => {
      expect(sut.dockerfile).toBe(dockerBuildConfig.dockerfile)
    })
    it('should set platform', () => {
      expect(sut.platform).toBe(dockerBuildConfig.platform)
    })
    it('should set target', () => {
      expect(sut.target).toBe(dockerBuildConfig.target)
    })
    it('should set build args without IMAGE_TAG (the tag is read at runtime, not baked)', () => {
      expect(sut.buildArgs).toEqual({
        BASE_IMAGE: dockerBuildConfig.baseImage,
        PROJECT_DIR: `${projectMetadata.parentDirName}/`,
        PROJECT: projectMetadata.projectName,
        TURBO_API: '',
        TURBO_TEAM: '',
      })
    })
    it('should not set cacheRef', () => {
      expect(sut.cacheRef).toBeUndefined()
    })
    it('should pass the turbo token as a build secret, not a build arg', () => {
      expect(sut.secrets).toEqual([{id: 'turbo_token', env: 'TURBO_TOKEN'}])
    })
  })

  describe('with IMAGE_TAG env var set', () => {
    beforeEach(() => {
      process.env.IMAGE_TAG = '20260601-00042-00100-dc38225'
    })
    afterEach(() => {
      delete process.env.IMAGE_TAG
    })

    it('should not pass IMAGE_TAG as a build arg', () => {
      const sut = makeBuildSettings(image, dockerBuildConfig, projectMetadata)
      expect(sut.buildArgs).not.toHaveProperty('IMAGE_TAG')
    })
  })

  describe('with buildCache config', () => {
    const cacheRegistry = 'harbor.local.abbottland.io/build-cache'
    const sut = makeBuildSettings(image, {...dockerBuildConfig, buildCache: cacheRegistry}, projectMetadata)

    it('should set cacheRef from buildCache config', () => {
      expect(sut.cacheRef).toBe(cacheRegistry)
    })
  })
})
