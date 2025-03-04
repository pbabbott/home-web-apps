import { DockerBuildConfig } from '../../config/abctl-config';
import { ProjectMetadata } from '../project';

export type DockerBuildSettings = {
  image: string;
  context?: string;
  dockerfile?: string;
  buildArgs?: Record<string, string>;
  push?: boolean;
  platform?: string;
};

export const makeBuildSettings = (
  image: string,
  dockerBuildConfig: DockerBuildConfig,
  projectMetadata: ProjectMetadata,
): DockerBuildSettings => {
  const { baseImage, context, dockerfile, platform } = dockerBuildConfig;

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
    platform,
  };
};
