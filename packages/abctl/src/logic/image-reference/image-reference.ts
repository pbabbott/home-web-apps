import { DockerBuildConfig } from '../../config/abctl-config';
import { config } from '../../config/config-loader';
import { ProjectMetadata } from '../project-metadata';

const getImage = (
  projectMetadata: ProjectMetadata,
  combinedBuildConfig: DockerBuildConfig,
  version: string,
): string => {
  const { projectName } = projectMetadata;
  const { repository } = combinedBuildConfig;

  const repositoryName = repository == '' ? projectName : repository;
  return `${config.registryWithNamespace}/${repositoryName}:${version}`;
};

export const getImageWithVersion = (
  projectMetadata: ProjectMetadata,
  combinedBuildConfig: DockerBuildConfig,
): string =>
  getImage(projectMetadata, combinedBuildConfig, projectMetadata.version);

export const getImageAsLatest = (
  projectMetadata: ProjectMetadata,
  combinedBuildConfig: DockerBuildConfig,
): string => getImage(projectMetadata, combinedBuildConfig, 'latest');
