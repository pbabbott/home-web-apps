import { DockerBuildConfig } from '../../config/abctl-config';
import { config } from '../../config/config-loader';
import { ProjectMetadata } from '../project-metadata';

const getImage = (
  projectMetadata: ProjectMetadata,
  combinedBuildConfig: DockerBuildConfig,
  tag: string,
): string => {
  const { projectName } = projectMetadata;
  const { repository } = combinedBuildConfig;

  const repositoryName = repository == '' ? projectName : repository;
  return `${config.registryWithNamespace}/${repositoryName}:${tag}`;
};

export const getImageWithVersion = (
  projectMetadata: ProjectMetadata,
  combinedBuildConfig: DockerBuildConfig,
): string => {
  const tag = combinedBuildConfig.tag || projectMetadata.version;
  return getImage(projectMetadata, combinedBuildConfig, tag);
};

export const getImageAsLatest = (
  projectMetadata: ProjectMetadata,
  combinedBuildConfig: DockerBuildConfig,
): string => getImage(projectMetadata, combinedBuildConfig, 'latest');
