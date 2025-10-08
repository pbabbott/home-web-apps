import fs from 'fs';

export const writeEnvFileKey = async (
  targetFile: string,
  envVarName: string,
  value: string,
) => {
  console.log(`📝 Writing secret key ${envVarName} to ${targetFile}...`);
  // parse the env file
  const envFile = fs.readFileSync(targetFile, 'utf8');
  const envFileLines = envFile.split('\n');
  const updatedEnvFileLines = envFileLines.map((line) => {
    if (line.includes(envVarName)) {
      return `${envVarName}=${value}`;
    }
    return line;
  });
  const output = updatedEnvFileLines.join('\n');
  return await fs.promises.writeFile(targetFile, output);
};
