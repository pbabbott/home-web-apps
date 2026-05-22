import {ProjectMetadata} from '../project-metadata.js'
import {DockerBuildSettings} from '../../docker-cli/docker-build-settings.js'
import {DockerBuildConfig} from '../../config/abctl-config.js'
export const makeBuildSettings = (
  image: string,
  dockerBuildConfig: DockerBuildConfig,
  projectMetadata: ProjectMetadata,
): DockerBuildSettings => {
  const {baseImage, context, dockerfile, load, push, buildCache, ...rest} = dockerBuildConfig

  const buildArgs: Record<string, string> = {}

  if (baseImage) {
    buildArgs.BASE_IMAGE = baseImage
  }

  // TODO: find a better way to detect/manage dockerfile and build args
  if (dockerfile == '../../docker/pnpm-turbo.Dockerfile') {
    // The trailing slash is needed here because of the dockerfile.
    buildArgs.PROJECT_DIR = `${projectMetadata.parentDirName}/`
    buildArgs.PROJECT = projectMetadata.projectName
  }

  return {
    image,
    context,
    dockerfile,
    buildArgs,
    load: load === 'true',
    push: push === 'true',
    ...(buildCache ? {cacheRef: buildCache} : {}),
    ...rest,
  }
}
