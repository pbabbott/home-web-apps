import { Command } from 'commander';

import { loadConfig } from '@abbottland/yaml-config';
import { AbctlConfig } from './abctl-config';

export let config = new AbctlConfig();
export const initConfig = async () => {
  // Parse command line for --config flag using commander
  const program = new Command();
  program.option('--config <path>', 'Path to config file', './abctl.yml');
  program.parse(process.argv);
  const options = program.opts();

  const pathToConfigFile = options.config;
  console.log(`⚙️  Using config file: ${pathToConfigFile}`);

  const defaultConfig = new AbctlConfig();
  config = await loadConfig(defaultConfig, pathToConfigFile);
  return config;
};
