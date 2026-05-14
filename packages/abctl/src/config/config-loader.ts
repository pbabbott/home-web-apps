import {loadConfig} from '@abbottland/yaml-config'
import {AbctlConfig} from './abctl-config.js'

export let config = new AbctlConfig()
export const initConfig = async (configPath: string) => {
  // Parse command line for --config flag using commander
  const pathToConfigFile = configPath
  console.log(`⚙️  Using config file: ${pathToConfigFile}`)

  config = await loadConfig(new AbctlConfig(), pathToConfigFile)
  return config
}
