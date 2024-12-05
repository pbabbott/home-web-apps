[**@abbottland/yaml-config**](../README.md)

***

[@abbottland/yaml-config](../README.md) / loadConfig

# Function: loadConfig()

> **loadConfig**\<`T`\>(`defaultConfig`, `configFilePath`?): `Promise`\<`T`\>

This function accepts a default config object and optionally a path to a config file in YAML format.
It will then combine these into a single output which will be a deeply merged object where the config file has a higher priority than the default configuration.
In addition, it will respect properties marked by `@EnvironmentVariable` and `@ConfigSection` to load in values via environment variables with the highest priority.

## Type Parameters

• **T**

the type of the config file to return; should match defaultConfig

## Parameters

### defaultConfig

`T`

The default configuration to use

### configFilePath?

`string`

OPTIONAL The path to the YAML configuration file

## Returns

`Promise`\<`T`\>

A strongly-typed object with all properties loaded.

## Example

```ts
const pathToConfigFile = '/etc/my-app/config.yml'

class ApplicationConfig {
  foo = 'default-value',
  bar = 'another-default-value'
}
const config = await loadConfig(pathToConfigFile, defaultConfig)
```

## Defined in

[config.ts:24](https://github.com/pbabbott/home-web-apps/blob/ec00bebc237422af4f5115f844c2c704b35aeb74/packages/yaml-config/src/lib/config.ts#L24)
