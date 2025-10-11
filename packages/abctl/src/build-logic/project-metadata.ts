import { readFileSync } from 'fs';
import path from 'path';

export type ProjectMetadata = {
  projectName: string;
  parentDirName: string;
  version: string;
};

export const getProjectName = () => {
  // Project name is just the name of the directory from which the script is called
  // For example apps/project-name
  // or packages/project-name
  return path.basename(process.cwd());
};

export const getProjectParentDirName = () => {
  // Project parent name is just the name of the parent directory from which the script is called
  // For example apps/
  // or packages/

  // Get the parent directory path
  const parentDirPath = path.dirname(process.cwd());
  // Get the name of the parent directory
  return path.basename(parentDirPath);
};

export const getPackageJsonVersion = () => {
  const packageJsonPath = path.resolve(process.cwd(), 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  return packageJson.version;
};

export const getProjectMetadata = (): ProjectMetadata => {
  const projectName = getProjectName();
  const parentDirName = getProjectParentDirName();
  const version = getPackageJsonVersion();
  return {
    projectName,
    parentDirName,
    version,
  };
};
