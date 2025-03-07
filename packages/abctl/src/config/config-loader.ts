import { loadConfig } from '@abbottland/yaml-config';
import { AbctlConfig } from './abctl-config';

export let config = new AbctlConfig();

export const initConfig = async () => {
  const pathToConfigFile = './abctl.yml';
  const defaultConfig = new AbctlConfig();
  config = await loadConfig(defaultConfig, pathToConfigFile);
  return config;
};
