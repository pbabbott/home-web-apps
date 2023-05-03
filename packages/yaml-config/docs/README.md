@home-web-apps/yaml-config

# @home-web-apps/yaml-config

## Table of contents

### Enumerations

- [EnvironmentVariableType](enums/EnvironmentVariableType.md)

### Type Aliases

- [AppConfigOptions](README.md#appconfigoptions)
- [ConfigSectionOptions](README.md#configsectionoptions)
- [EnvironmentVariableOptions](README.md#environmentvariableoptions)

### Functions

- [AppConfig](README.md#appconfig)
- [ConfigSection](README.md#configsection)
- [EnvironmentVariable](README.md#environmentvariable)
- [loadConfig](README.md#loadconfig)

## Type Aliases

### AppConfigOptions

Ƭ **AppConfigOptions**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `appPrefix?` | `string` |

#### Defined in

[lib/decorators.ts:5](https://github.com/pbabbott/home-web-apps/blob/1b7448b/packages/yaml-config/src/lib/decorators.ts#L5)

___

### ConfigSectionOptions

Ƭ **ConfigSectionOptions**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `sectionPrefix?` | `string` |

#### Defined in

[lib/decorators.ts:18](https://github.com/pbabbott/home-web-apps/blob/1b7448b/packages/yaml-config/src/lib/decorators.ts#L18)

___

### EnvironmentVariableOptions

Ƭ **EnvironmentVariableOptions**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `variableName?` | `string` |
| `variableType?` | [`EnvironmentVariableType`](enums/EnvironmentVariableType.md) |

#### Defined in

[lib/decorators.ts:38](https://github.com/pbabbott/home-web-apps/blob/1b7448b/packages/yaml-config/src/lib/decorators.ts#L38)

## Functions

### AppConfig

▸ **AppConfig**(`options?`): `ClassDecorator`

#### Parameters

| Name | Type |
| :------ | :------ |
| `options?` | [`AppConfigOptions`](README.md#appconfigoptions) |

#### Returns

`ClassDecorator`

#### Defined in

[lib/decorators.ts:9](https://github.com/pbabbott/home-web-apps/blob/1b7448b/packages/yaml-config/src/lib/decorators.ts#L9)

___

### ConfigSection

▸ **ConfigSection**(`options?`): `PropertyDecorator`

#### Parameters

| Name | Type |
| :------ | :------ |
| `options` | [`ConfigSectionOptions`](README.md#configsectionoptions) |

#### Returns

`PropertyDecorator`

#### Defined in

[lib/decorators.ts:22](https://github.com/pbabbott/home-web-apps/blob/1b7448b/packages/yaml-config/src/lib/decorators.ts#L22)

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

[lib/decorators.ts:43](https://github.com/pbabbott/home-web-apps/blob/1b7448b/packages/yaml-config/src/lib/decorators.ts#L43)

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

[lib/config.ts:23](https://github.com/pbabbott/home-web-apps/blob/1b7448b/packages/yaml-config/src/lib/config.ts#L23)
