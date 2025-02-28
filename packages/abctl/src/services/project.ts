import path from 'path';

export const getProjectName = () => {
  // Project name is just the name of the directory from which the script is called
  // For example apps/project-name
  // or packages/project-name
  return path.basename(process.cwd());
};
