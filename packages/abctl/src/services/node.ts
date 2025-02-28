import { readFileSync } from 'fs';
import path from 'path';

export const getPackageJsonVersion = () => {
  const packageJsonPath = path.resolve(process.cwd(), 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  return packageJson.version;
};
