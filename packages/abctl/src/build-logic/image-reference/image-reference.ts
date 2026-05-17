import {loadConfig} from '@abbottland/yaml-config'
import {AbctlConfig, DockerBuildConfig} from '../../config/abctl-config.js'
import {config} from '../../config/config-loader.js'
import {ProjectMetadata} from '../project-metadata.js'

const getImage = (projectMetadata: ProjectMetadata, combinedBuildConfig: DockerBuildConfig, tag: string): string => {
  const {projectName} = projectMetadata
  const {repository} = combinedBuildConfig

  const repositoryName = repository == '' ? projectName : repository
  return `${config.registryWithNamespace}/${repositoryName}:${tag}`
}

export const getImageWithVersion = (
  projectMetadata: ProjectMetadata,
  combinedBuildConfig: DockerBuildConfig,
): string => {
  const tag = combinedBuildConfig.tag || projectMetadata.version
  return getImage(projectMetadata, combinedBuildConfig, tag)
}

export const getImageAsLatest = (projectMetadata: ProjectMetadata, combinedBuildConfig: DockerBuildConfig): string =>
  getImage(projectMetadata, combinedBuildConfig, 'latest')

export const resolveBaseImage = async (baseConfigPath: string, projectMetadata: ProjectMetadata): Promise<string> => {
  const baseAbctlConfig = await loadConfig(new AbctlConfig(), baseConfigPath)
  const repositoryName = baseAbctlConfig.build.repository || projectMetadata.projectName
  const tag = baseAbctlConfig.build.tag || projectMetadata.version
  return `${baseAbctlConfig.registryWithNamespace}/${repositoryName}:${tag}`
}
