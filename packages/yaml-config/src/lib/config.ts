import { fileExists, parseYAMLFile } from "./file"
import { merge } from 'lodash'

/**
 * This function accepts a path to a config file in YAML format and a default config object.
 * It will then combine these into a single output which will be a deeply merged object where the config file has a higher priority than the default configuration.
 * @example
 * ```ts
 * const pathToConfigFile = '/etc/my-app/config.yml'
 * const defaultConfig = {
 *   foo: 'default-value', 
 *   bar: 'another-default-value' 
 * }
 * const config = await loadConfig(pathToConfigFile, defaultConfig)
 * ```
 * @param configFilePath The path to the YAML configuration file
 * @param defaultConfig The default configuration to use 
 * @typeParam T - the type of the config file to return; should match defaultConfig
 * @returns A strongly-typed object with all properties loaded.
 */
export const loadConfig = async <T> (configFilePath: string, defaultConfig: T): Promise<T> => {
    
    const configFileExists = await fileExists(configFilePath)

    if (!configFileExists) {
        return defaultConfig
    }

    const fileConfig = await parseYAMLFile(configFilePath)
    return merge({}, defaultConfig, fileConfig)
}