import {
  checkRemoteImageExists,
  dockerBuild,
} from './services/docker-service/docker-commands';
import { getImageAsLatest, ProjectMetadata } from './services/project';
import { getImageWithVersion, getProjectMetadata } from './services/project';
import { initConfig } from './config/config-loader';
import {
  getBuildConfigFromPresetName,
  getMergedBuildConfig,
} from './config/build-presets';
import { makeBuildSettings } from './services/docker-service/build-settings';
import { AbctlConfig } from './config/AbctlConfig';

const getBuiltSettings = (
  config: AbctlConfig,
  imageWithVersion: string,
  projectMetadata: ProjectMetadata,
) => {
  // Get a build config from the user and the preset
  const buildPreset = config.buildPreset;
  const presetBuildConfig = getBuildConfigFromPresetName(buildPreset);
  const userBuildConfig = config.build;
  const buildConfig = getMergedBuildConfig(userBuildConfig, presetBuildConfig);

  // Use the build config to make docker build settings
  return makeBuildSettings(imageWithVersion, buildConfig, projectMetadata);
};

export const abctlDockerBuild = async () => {
  console.log('🏎️  Starting docker build process...');

  const config = await initConfig();

  // Get metadata regarding the project, dir, and version
  const projectMetadata = getProjectMetadata();

  // Determine a versioned image name
  const imageWithVersion = getImageWithVersion(
    projectMetadata.projectName,
    projectMetadata.version,
  );
  console.log(`🎯 Target image is ${imageWithVersion}`);

  const dockerBuildSettings = getBuiltSettings(
    config,
    imageWithVersion,
    projectMetadata,
  );
  await dockerBuild(dockerBuildSettings);
};

export const abctlDockerPublish = async () => {
  console.log('🏎️  Starting docker publish process...');
  const config = await initConfig();
  const projectMetadata = getProjectMetadata();
  const imageWithVersion = getImageWithVersion(
    projectMetadata.projectName,
    projectMetadata.version,
  );
  const imageAsLatest = getImageAsLatest(projectMetadata.projectName);

  console.log(`🎯 Target image is ${imageWithVersion}`);

  const remoteImageExists = await checkRemoteImageExists(imageWithVersion);
  if (remoteImageExists) {
    console.log(`⚠️  Nothing to do. Skipping push. Program terminated.`);
    return;
  }

  const buildSettings = getBuiltSettings(
    config,
    imageWithVersion,
    projectMetadata,
  );
  buildSettings.push = true;

  // This will perform a push on the versioned image
  await dockerBuild(buildSettings);

  // This will perform a push on the latest image
  buildSettings.image = imageAsLatest;
  await dockerBuild(buildSettings);
};
