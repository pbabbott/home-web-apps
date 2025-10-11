import fs from 'fs';
import { SecretConfig } from '../config/abctl-config';

export const copyEnvFile = async (secretConfig: SecretConfig) => {
  console.log('📝 Generating env file...');

  const envFile = secretConfig.envFile;
  const envSampleFile = secretConfig.envSampleFile;

  // check if the env sample file exists
  if (!fs.existsSync(envSampleFile)) {
    console.error(`🚫 Env sample file does not exist: ${envSampleFile}`);
    return;
  }

  console.log(`📝 Copying env file from ${envSampleFile} to ${envFile}...`);

  return new Promise<void>((resolve, reject) => {
    fs.copyFile(envSampleFile, envFile, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};
