import 'reflect-metadata'
import { camelToSnakeCase } from './utilities';
import { configSectionKey, environmentVariableKey, environmentVariableTypeKey, appConfigKey } from './constants';

export type AppConfigOptions = {
    appPrefix?: string,
}

export const AppConfig = (options?: AppConfigOptions): ClassDecorator => {
   return (target: object) => {
        if (options && options.appPrefix){
            Reflect.defineMetadata(appConfigKey, options.appPrefix, target);
        }
        
   }
}

export type ConfigSectionOptions = {
    sectionPrefix?: string,
}

export const ConfigSection = (options: ConfigSectionOptions = {}): PropertyDecorator => {
    return (target: object, propertyKey: string | symbol) => {

        const { sectionPrefix } = options
        const metadata = sectionPrefix ? sectionPrefix : camelToSnakeCase(propertyKey as string)

        Reflect.defineMetadata(configSectionKey, metadata, target, propertyKey);
    }
}

export enum EnvironmentVariableType {
    STRING = 0,
    NUMBER = 1,
    BOOLEAN = 2
}

export type EnvironmentVariableOptions = {
    variableName?: string,
    variableType?: EnvironmentVariableType
}

export const EnvironmentVariable = (options: EnvironmentVariableOptions = { variableType: EnvironmentVariableType.STRING }): PropertyDecorator => {
    return (target: object, propertyKey: string | symbol) => {
        
        const { variableName, variableType} = options
        
        // Define the environment variable name
        const metadata = variableName ? variableName : camelToSnakeCase(propertyKey as string)
        Reflect.defineMetadata(environmentVariableKey, metadata, target, propertyKey);

        // Define the type of the property using the enum
        Reflect.defineMetadata(environmentVariableTypeKey, variableType ?? EnvironmentVariableType.STRING, target, propertyKey);
    }
};
