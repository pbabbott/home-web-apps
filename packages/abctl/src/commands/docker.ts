import { initConfig } from '../config/config-loader';
import {
  checkRemoteImageExists,
  dockerBuild,
} from '../docker-cli/docker-commands';
import { combineBuildConfigs } from '../logic/build-config-merger/build-config-merger';
import { makeBuildSettings } from '../logic/docker-build-settings-builder/docker-build-settings-builder';
import {
  getImageAsLatest,
  getImageWithVersion,
} from '../logic/image-reference/image-reference';
import { getProjectMetadata } from '../logic/project-metadata';

export const abctlDockerBuild = async () => {
  console.log('🏎️  Starting docker build process...');

  // Read and combine the config with any presets
  const config = await initConfig();
  const combinedBuildConfig = combineBuildConfigs(config);

  // Get metadata regarding the project, dir, and version
  const projectMetadata = getProjectMetadata();

  // Determine a versioned image name
  const imageWithVersion = getImageWithVersion(
    projectMetadata,
    combinedBuildConfig,
  );
  console.log(`🎯 Target image is ${imageWithVersion}`);

  // Finally run docker build making the build settings
  const dockerBuildSettings = makeBuildSettings(
    imageWithVersion,
    combinedBuildConfig,
    projectMetadata,
  );
  await dockerBuild(dockerBuildSettings);
};

export const abctlDockerPublish = async () => {
  console.log('🏎️  Starting docker publish process...');
  // Read and combine the config with any presets
  const config = await initConfig();
  const combinedBuildConfig = combineBuildConfigs(config);

  // Get metadata regarding the project, dir, and version
  const projectMetadata = getProjectMetadata();

  // Determine a versioned image name & latest image name
  const imageWithVersion = getImageWithVersion(
    projectMetadata,
    combinedBuildConfig,
  );
  const imageAsLatest = getImageAsLatest(projectMetadata, combinedBuildConfig);
  console.log(`🎯 Target image is ${imageWithVersion}`);

  const remoteImageExists = await checkRemoteImageExists(imageWithVersion);
  if (remoteImageExists) {
    console.log('⚠️  Nothing to do. Skipping push. Program terminated.');
    return;
  }

  // Finally run docker build making the build settings
  const dockerBuildSettings = makeBuildSettings(
    imageWithVersion,
    combinedBuildConfig,
    projectMetadata,
  );
  dockerBuildSettings.push = true;

  // This will perform a push on the versioned image
  await dockerBuild(dockerBuildSettings);

  // This will perform a push on the latest image
  dockerBuildSettings.image = imageAsLatest;
  await dockerBuild(dockerBuildSettings);
};
