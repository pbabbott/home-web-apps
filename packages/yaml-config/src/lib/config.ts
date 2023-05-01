import { fileExists, parseYAMLFile } from "./file"
import { merge } from 'lodash'

/**
 * This function looks for a config file in YAML format and a default config object.  
 * The output will be a deeply merged object where the config file has higher priority than the default configuration
 * @param configFilePath The path to the YAML configuration file
 * @param defaultConfig The default configuration to use 
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