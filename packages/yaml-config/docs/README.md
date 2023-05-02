@home-web-apps/yaml-config

# @home-web-apps/yaml-config

## Table of contents

### Enumerations

- [EnvironmentVariableType](enums/EnvironmentVariableType.md)

### Type Aliases

- [EnvironmentVariableOptions](README.md#environmentvariableoptions)

### Functions

- [ConfigSection](README.md#configsection)
- [EnvironmentVariable](README.md#environmentvariable)
- [loadConfig](README.md#loadconfig)

## Type Aliases

### EnvironmentVariableOptions

Ƭ **EnvironmentVariableOptions**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `variableName?` | `string` |
| `variableType?` | [`EnvironmentVariableType`](enums/EnvironmentVariableType.md) |

#### Defined in

[lib/decorators.ts:20](https://github.com/pbabbott/home-web-apps/blob/2a3a32f/packages/yaml-config/src/lib/decorators.ts#L20)

## Functions

### ConfigSection

▸ **ConfigSection**(`variableName?`): `PropertyDecorator`

#### Parameters

| Name | Type |
| :------ | :------ |
| `variableName?` | `string` |

#### Returns

`PropertyDecorator`

#### Defined in

[lib/decorators.ts:6](https://github.com/pbabbott/home-web-apps/blob/2a3a32f/packages/yaml-config/src/lib/decorators.ts#L6)

___

### EnvironmentVariable

▸ **EnvironmentVariable**(`options?`): `PropertyDecorator`

#### Parameters

| Name | Type |
| :------ | :------ |
| `options` | [`EnvironmentVariableOptions`](README.md#environmentvariableoptions) |

#### Returns

`PropertyDecorator`

#### Defined in

[lib/decorators.ts:25](https://github.com/pbabbott/home-web-apps/blob/2a3a32f/packages/yaml-config/src/lib/decorators.ts#L25)

___

### loadConfig

▸ **loadConfig**<`T`\>(`defaultConfig`, `configFilePath?`): `Promise`<`T`\>

This function accepts a default config object and optionally a path to a config file in YAML format.
It will then combine these into a single output which will be a deeply merged object where the config file has a higher priority than the default configuration.
In addition, it will respect properties marked by

**`Environment Variable`**

and

**`Config Section`**

to load in values via environment variables with the highest priority.

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
| `defaultConfig` | `T` | The default configuration to use |
| `configFilePath?` | `string` | OPTIONAL The path to the YAML configuration file |

#### Returns

`Promise`<`T`\>

A strongly-typed object with all properties loaded.

#### Defined in

[lib/config.ts:23](https://github.com/pbabbott/home-web-apps/blob/2a3a32f/packages/yaml-config/src/lib/config.ts#L23)
