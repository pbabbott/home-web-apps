import { EnvironmentVariableType } from "./decorators";
import { appConfigKey, configSectionKey, environmentVariableKey, environmentVariableTypeKey } from './constants'

const getNextName = (configSectionPrefix:string, name:string) => {
    const result = configSectionPrefix ? `${configSectionPrefix}_` : ''

    return result + name
}

const parseEnvironmentVariableValue = (envValue: string, envType: EnvironmentVariableType) => {
    if (envType === EnvironmentVariableType.NUMBER) return Number(envValue)
    if (envType === EnvironmentVariableType.BOOLEAN) return Boolean(envValue)

    return envValue
}


export const getEnvConfig = (defaultConfig: any, configSectionPrefix = ""): object => {
    const keys = Object.keys(defaultConfig)
    const result: any = {}

    const appConfigMetadata = Reflect.getMetadata(appConfigKey, defaultConfig.constructor.prototype, "class");
    const prefix = appConfigMetadata ? appConfigMetadata : configSectionPrefix

    keys.map(key => {
        const envMetadata = Reflect.getMetadata(environmentVariableKey, defaultConfig, key);

        if (envMetadata){
            // Only set values with environment variables if there is a decorator, and if a value is defined
            const envName = getNextName(prefix, envMetadata)
            const envValue = process.env[envName]
            
            if (envValue !== undefined) {
                const envType = Reflect.getMetadata(environmentVariableTypeKey, defaultConfig, key) as EnvironmentVariableType
                result[key] = parseEnvironmentVariableValue(envValue, envType)
            }

        } 
        
        const configSectionMetadata = Reflect.getMetadata(configSectionKey, defaultConfig, key);
        if (configSectionMetadata) {
            // Next, recurse down the object for properties marked by @ConfigSection
            const nextPrefix = getNextName(prefix, configSectionMetadata)
            result[key] = getEnvConfig(defaultConfig[key], nextPrefix)
        }

    })
    
    return result
}