import { getEnvConfig } from './environment';
import { fileExists, parseYAMLFile } from './file';
import { merge } from 'lodash';

/**
 * This function accepts a default config object and optionally a path to a config file in YAML format.
 * It will then combine these into a single output which will be a deeply merged object where the config file has a higher priority than the default configuration.
 * In addition, it will respect properties marked by `@EnvironmentVariable` and `@ConfigSection` to load in values via environment variables with the highest priority.
 * @example
 * ```ts
 * const pathToConfigFile = '/etc/my-app/config.yml'
 *
 * class ApplicationConfig {
 *   foo = 'default-value',
 *   bar = 'another-default-value'
 * }
 * const config = await loadConfig(pathToConfigFile, defaultConfig)
 * ```
 * @param defaultConfig The default configuration to use
 * @param configFilePath OPTIONAL The path to the YAML configuration file
 * @typeParam T - the type of the config file to return; should match defaultConfig
 * @returns A strongly-typed object with all properties loaded.
 */
export const loadConfig = async <T>(
  defaultConfig: T,
  configFilePath?: string,
): Promise<T> => {
  // First, Load a config file if one was specified.
  let fileConfig = {};
  if (configFilePath) {
    const configFileExists = await fileExists(configFilePath);

    if (!configFileExists) {
      return defaultConfig;
    }

    fileConfig = await parseYAMLFile(configFilePath);
  }

  // Next, get a JSON object using environment variables
  const envConfig = getEnvConfig(defaultConfig);

  return merge({}, defaultConfig, fileConfig, envConfig);
};
