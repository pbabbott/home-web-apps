import { ProjectMetadata } from '../project-metadata';
import { DockerBuildSettings } from '../../docker-cli/docker-build-settings';
import { DockerBuildConfig } from '../../config/abctl-config';
export const makeBuildSettings = (
  image: string,
  dockerBuildConfig: DockerBuildConfig,
  projectMetadata: ProjectMetadata,
): DockerBuildSettings => {
  const { baseImage, context, dockerfile, ...rest } = dockerBuildConfig;

  const buildArgs: Record<string, string> = {};

  if (baseImage) {
    buildArgs.BASE_IMAGE = baseImage;
  }

  // TODO: find a better way to detect/manage dockerfile and build args
  if (dockerfile == '../../docker/pnpm-turbo.Dockerfile') {
    // The trailing slash is needed here because of the dockerfile.
    buildArgs.PROJECT_DIR = `${projectMetadata.parentDirName}/`;
    buildArgs.PROJECT = projectMetadata.projectName;
  }

  return {
    image,
    context,
    dockerfile,
    buildArgs,
    ...rest,
  };
};
