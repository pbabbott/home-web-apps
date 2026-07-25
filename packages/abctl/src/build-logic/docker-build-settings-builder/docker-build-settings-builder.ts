import {ProjectMetadata} from '../project-metadata.js'
import {DockerBuildSecret, DockerBuildSettings} from '../../docker-cli/docker-build-settings.js'
import {DockerBuildConfig} from '../../config/abctl-config.js'
export const makeBuildSettings = (
  image: string,
  dockerBuildConfig: DockerBuildConfig,
  projectMetadata: ProjectMetadata,
): DockerBuildSettings => {
  const {baseImage, context, dockerfile, load, push, buildCache, ...rest} = dockerBuildConfig

  const buildArgs: Record<string, string> = {}
  const secrets: DockerBuildSecret[] = []

  if (baseImage) {
    buildArgs.BASE_IMAGE = baseImage
  }

  // TODO: find a better way to detect/manage dockerfile and build args
  if (dockerfile == '../../docker/pnpm-turbo.Dockerfile') {
    // The trailing slash is needed here because of the dockerfile.
    buildArgs.PROJECT_DIR = `${projectMetadata.parentDirName}/`
    buildArgs.PROJECT = projectMetadata.projectName
    buildArgs.IMAGE_TAG = process.env.IMAGE_TAG ?? image.split(':').pop() ?? ''

    // Lets `turbo build` inside the container hit Turbo's remote cache
    // instead of recompiling every package from scratch. TURBO_API/TEAM
    // aren't sensitive, so they go in as regular build args; the token is
    // passed as a buildx secret so it never lands in an image layer.
    buildArgs.TURBO_API = process.env.TURBO_API ?? ''
    buildArgs.TURBO_TEAM = process.env.TURBO_TEAM ?? ''
    secrets.push({id: 'turbo_token', env: 'TURBO_TOKEN'})
  }

  return {
    image,
    context,
    dockerfile,
    buildArgs,
    secrets,
    load: load === 'true',
    push: push === 'true',
    ...(buildCache ? {cacheRef: buildCache} : {}),
    ...rest,
  }
}
