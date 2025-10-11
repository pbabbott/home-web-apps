import { OnePasswordItemConfig } from '../config/abctl-config';
import { initConfig } from '../config/config-loader';
import { copyEnvFile } from '../env-logic/env-file-copier';
import { writeEnvFileKey } from '../env-logic/env-file-key-writer';
import { getOnePasswordValue } from '../onePassword/onePasswordClient';

type OnePasswordItemWithValue = OnePasswordItemConfig & {
  value: string;
};

export const abctlSecretsGenerateEnv = async () => {
  console.log('🏎️  Starting secrets generate process...');
  // Read and combine the config with any presets
  const config = await initConfig();

  if (!config.secrets.generateEnv) {
    console.log('🚫 Secrets generation is disabled. Skipping...');
    return;
  }

  // copy the sample file to the env file overwriting any existing file
  await copyEnvFile(config.secrets);

  // Loop through the secrets and fetch values from 1Password
  const { vault } = config.secrets.onePassword;
  const fetchedSecrets: OnePasswordItemWithValue[] = await Promise.all(
    config.secrets.onePassword.items.map(async (x) => {
      return {
        ...x,
        value: await getOnePasswordValue(vault, x.secretName, x.secretKey),
      };
    }),
  );

  // Loop through the fetched secrets and write the key to the env file
  // This should be synchronous to avoid race conditions
  for (const item of fetchedSecrets) {
    await writeEnvFileKey(config.secrets.envFile, item.envVarName, item.value);
  }

  console.log('🎉 Secrets generated successfully.');
};
