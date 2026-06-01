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
    it('should set build args with IMAGE_TAG from image ref when env var not set', () => {
      expect(sut.buildArgs).toEqual({
        BASE_IMAGE: dockerBuildConfig.baseImage,
        PROJECT_DIR: `${projectMetadata.parentDirName}/`,
        PROJECT: projectMetadata.projectName,
        IMAGE_TAG: '20260101-001-abc1234',
      })
    })
    it('should not set cacheRef', () => {
      expect(sut.cacheRef).toBeUndefined()
    })
  })

  describe('with IMAGE_TAG env var set', () => {
    const envTag = '20260601-042-dc38225'

    beforeEach(() => {
      process.env.IMAGE_TAG = envTag
    })
    afterEach(() => {
      delete process.env.IMAGE_TAG
    })

    it('should prefer IMAGE_TAG env var over image ref tag', () => {
      const sut = makeBuildSettings(image, dockerBuildConfig, projectMetadata)
      expect(sut.buildArgs?.IMAGE_TAG).toBe(envTag)
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
