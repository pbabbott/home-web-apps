@home-web-apps/yaml-config

# @home-web-apps/yaml-config

## Table of contents

### Functions

- [loadConfig](README.md#loadconfig)

## Functions

### loadConfig

▸ **loadConfig**<`T`\>(`configFilePath`, `defaultConfig`): `Promise`<`T`\>

This function accepts a path to a config file in YAML format and a default config object.
It will then combine these into a single output which will be a deeply merged object where the config file has a higher priority than the default configuration.

**`Example`**

```ts
const pathToConfigFile = '/etc/my-app/config.yml'
const defaultConfig = {
  foo: 'default-value', 
  bar: 'another-default-value' 
}
const config = await loadConfig(pathToConfigFile, defaultConfig)
```

#### Type parameters

| Name | Description |
| :------ | :------ |
| `T` | the type of the config file to return; should match defaultConfig |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `configFilePath` | `string` | The path to the YAML configuration file |
| `defaultConfig` | `T` | The default configuration to use |

#### Returns

`Promise`<`T`\>

A strongly-typed object with all properties loaded.

#### Defined in

[lib/config.ts:21](https://github.com/pbabbott/home-web-apps/blob/2158a9a/packages/yaml-config/src/lib/config.ts#L21)
