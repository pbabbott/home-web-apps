import {OnePasswordItemConfig} from '../../config/abctl-config.js'
import {initConfig} from '../../config/config-loader.js'
import {copyEnvFile} from '../../env-logic/env-file-copier.js'
import {writeEnvFileKey} from '../../env-logic/env-file-key-writer.js'
import {getOnePasswordValue} from '../../onePassword/onePasswordClient.js'
import {BaseCommand} from '../../baseCommand.js'

type OnePasswordItemWithValue = OnePasswordItemConfig & {
  value: string
}

export default class SecretsGenerateEnv extends BaseCommand {
  static description = 'Generate .env file from 1Password secrets'

  static examples = ['<%= config.bin %> <%= command.id %>']

  public async run(): Promise<void> {
    const {flags} = await this.parse(SecretsGenerateEnv)
    console.log('🏎️  Starting secrets generate process...')
    // Read and combine the config with any presets
    const config = await initConfig(flags.config)

    if (!config.secrets.generateEnv) {
      console.log('🚫 Secrets generation is disabled. Skipping...')
      return
    }

    // copy the sample file to the env file overwriting any existing file
    await copyEnvFile(config.secrets)

    // Loop through the secrets and fetch values from 1Password
    const {vault} = config.secrets.onePassword
    const fetchedSecrets: OnePasswordItemWithValue[] = await Promise.all(
      config.secrets.onePassword.items.map(async (x) => {
        return {
          ...x,
          value: await getOnePasswordValue(vault, x.secretName, x.secretKey),
        }
      }),
    )

    // Loop through the fetched secrets and write the key to the env file
    // This should be synchronous to avoid race conditions
    for (const item of fetchedSecrets) {
      await writeEnvFileKey(config.secrets.envFile, item.envVarName, item.value)
    }

    console.log('🎉 Secrets generated successfully.')
  }
}
