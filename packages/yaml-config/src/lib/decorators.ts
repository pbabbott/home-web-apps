import 'reflect-metadata'
import { camelToUpperCaseSnakeCase } from './utilities';
import { configSectionKey, environmentVariableKey, environmentVariableTypeKey, appConfigKey } from './constants';

/**
 * These are options that affect the entire application configuration
 */
export type AppConfigOptions = {
    /**
     * This is the prefix for all other environment variables. 
     * Optionally set this value to something in UPPER_CASE_SNAKE_CASE.
     */
    appPrefix?: string,
}

/**
 * Use this decorator on the root class that manages your application config.  
 * Presently this is only used to set a prefix for environment variables.
 * @example 
 * ```ts
 * @AppConfig({ appPrefix: 'YAML_CONFIG' })
 * class ApplicationConfig {
 *   @EnvironmentVariable()
 *   foo = 'default-value',
 * }
 * ```
 * @param options Options to configure a prefix for environment variables
 * @returns ClassDecorator
 */
export const AppConfig = (options: AppConfigOptions = {}): ClassDecorator => {
   return (constructor) => {
        const metadata = options.appPrefix ? options.appPrefix : ''
        Reflect.defineMetadata(appConfigKey, metadata, constructor.prototype, "class")
   }
}

/**
 * These are options that affect just one section of the application configuration
 */
export type ConfigSectionOptions = {
    /**
     * This is the prefix for the config section.  By default, the property name will be converted to UPPER_CASE_SNAKE_CASE
     * If you'd like you can override this prefix by specifying a custom value here.
     */
    sectionPrefix?: string,
}

/**
 * Use this Property Decorator to mark sub-sections of your configuration.  
 * Without this decorator, environment variables will not be loaded for this section.
 * @example 
 * ```ts
 * class SectionConfig {
 *    @EnvironmentVariable()
 *    baz = 'default-value-goes-here'
 * }
 * 
 * @AppConfig({appPrefix: 'YAML_CONFIG' })
 * class ApplicationConfig {
 *   foo = 'default-value',
 * 
 *   @ConfigSection()
 *   bar = new SectionConfig()
 * }
 * ```
 * @param options Options to configure a prefix for environment variables for just this section.
 * @returns PropertyDecorator 
 */
export const ConfigSection = (options: ConfigSectionOptions = {}): PropertyDecorator => {
    return (target: object, propertyKey: string | symbol) => {

        const { sectionPrefix } = options
        const metadata = sectionPrefix ? sectionPrefix : camelToUpperCaseSnakeCase(propertyKey as string)

        Reflect.defineMetadata(configSectionKey, metadata, target, propertyKey);
    }
}

/**
 * Enum to help with loading environment variables into TypeScript into the proper type
 */
export enum EnvironmentVariableType {
    /**
     * Environment variable should be treated as a String.  This is the default option.
     */
    STRING,

    /**
     * Environment variable should be treated as a Number(). 
     */
    NUMBER,


    /**
     * Environment variable should be as a Boolean.
     */
    BOOLEAN
}

/**
 * These are options that affect just one environment variable of your application configuration.
 */
export type EnvironmentVariableOptions = {
    /**
     * Use this to use a custom environment variable name.
     * By default, the property name will be converted to UPPER_CASE_SNAKE_CASE
     * NOTE: the suffix
     */
    variableName?: string,
    variableType?: EnvironmentVariableType
}

/**
 * Use this decorator to mark a property in your application configuration as a field that can be provided via environment variable
 * @example 
 * ```ts
 * class ApplicationConfig {
 *   @EnvironmentVariable()
 *   foo = 'default-value',
 *  
 *   @EnvironmentVariable({  variableType: EnvironmentVariableType.NUMBER })
 *   bar = 123
 * }
 * ```
 * @param options Options to set aspects of how this environment variable is loaded
 * @returns PropertyDecorator
 */
export const EnvironmentVariable = (options: EnvironmentVariableOptions = { variableType: EnvironmentVariableType.STRING }): PropertyDecorator => {
    return (target: object, propertyKey: string | symbol) => {
        
        const { variableName, variableType} = options
        
        // Define the environment variable name
        const metadata = variableName ? variableName : camelToUpperCaseSnakeCase(propertyKey as string)
        Reflect.defineMetadata(environmentVariableKey, metadata, target, propertyKey);

        // Define the type of the property using the enum
        Reflect.defineMetadata(environmentVariableTypeKey, variableType ?? EnvironmentVariableType.STRING, target, propertyKey);
    }
};
