import { checkRemoteImageExists, dockerBuildXBuild } from './services/docker';
import { getPackageJsonVersion } from './services/node';
import { getProjectName } from './services/project';

export const dockerBuild = async () => {
  console.log('🏎️  Starting docker build process...');

  const projectName = getProjectName();
  const version = getPackageJsonVersion();

  const image = `harbor.local.abbottland.io/library/${projectName}:${version}`;
  console.log(`🎯 Target image is ${image}`);

  await dockerBuildXBuild(image);
};

export const dockerPublish = async () => {
  console.log('🏎️  Starting docker publish process...');

  const projectName = getProjectName();
  const version = getPackageJsonVersion();

  const image = `harbor.local.abbottland.io/library/${projectName}`;
  const imageWithVersion = `${image}:${version}`;
  const imageAsLatest = `${image}:latest`;

  console.log(`🎯 Target image is ${imageWithVersion}`);

  const remoteImageExists = await checkRemoteImageExists(imageWithVersion);
  if (remoteImageExists) {
    console.log(`⚠️  Nothing to do. Skipping push. Program terminated.`);
    return;
  }

  await dockerBuildXBuild(imageWithVersion, true);
  await dockerBuildXBuild(imageAsLatest, true);
};
