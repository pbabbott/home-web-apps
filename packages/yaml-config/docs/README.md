@abbottland/yaml-config

# @abbottland/yaml-config

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

These are options that affect the entire application configuration

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `appPrefix?` | `string` | This is the prefix for all other environment variables. Optionally set this value to something in UPPER_CASE_SNAKE_CASE. |

#### Defined in

[lib/decorators.ts:8](https://github.com/pbabbott/home-web-apps/blob/7135569/packages/yaml-config/src/lib/decorators.ts#L8)

___

### ConfigSectionOptions

Ƭ **ConfigSectionOptions**: `Object`

These are options that affect just one section of the application configuration

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `sectionPrefix?` | `string` | This is the prefix for the config section. By default, the property name will be converted to UPPER_CASE_SNAKE_CASE If you'd like you can override this prefix by specifying a custom value here. |

#### Defined in

[lib/decorators.ts:40](https://github.com/pbabbott/home-web-apps/blob/7135569/packages/yaml-config/src/lib/decorators.ts#L40)

___

### EnvironmentVariableOptions

Ƭ **EnvironmentVariableOptions**: `Object`

These are options that affect just one environment variable of your application configuration.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `variableName?` | `string` | Use this to use a custom environment variable name. By default, the property name will be converted to UPPER_CASE_SNAKE_CASE NOTE: the suffix |
| `variableType?` | [`EnvironmentVariableType`](enums/EnvironmentVariableType.md) | - |

#### Defined in

[lib/decorators.ts:103](https://github.com/pbabbott/home-web-apps/blob/7135569/packages/yaml-config/src/lib/decorators.ts#L103)

## Functions

### AppConfig

▸ **AppConfig**(`options?`): `ClassDecorator`

Use this decorator on the root class that manages your application config.  
Presently this is only used to set a prefix for environment variables.

**`Example`**

```ts
@AppConfig({ appPrefix: 'YAML_CONFIG' })
class ApplicationConfig {
  @EnvironmentVariable()
  foo = 'default-value',
}
```

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `options` | [`AppConfigOptions`](README.md#appconfigoptions) | Options to configure a prefix for environment variables |

#### Returns

`ClassDecorator`

ClassDecorator

#### Defined in

[lib/decorators.ts:30](https://github.com/pbabbott/home-web-apps/blob/7135569/packages/yaml-config/src/lib/decorators.ts#L30)

___

### ConfigSection

▸ **ConfigSection**(`options?`): `PropertyDecorator`

Use this Property Decorator to mark sub-sections of your configuration.  
Without this decorator, environment variables will not be loaded for this section.

**`Example`**

```ts
class SectionConfig {
   @EnvironmentVariable()
   baz = 'default-value-goes-here'
}

@AppConfig({appPrefix: 'YAML_CONFIG' })
class ApplicationConfig {
  foo = 'default-value',

  @ConfigSection()
  bar = new SectionConfig()
}
```

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `options` | [`ConfigSectionOptions`](README.md#configsectionoptions) | Options to configure a prefix for environment variables for just this section. |

#### Returns

`PropertyDecorator`

PropertyDecorator

#### Defined in

[lib/decorators.ts:69](https://github.com/pbabbott/home-web-apps/blob/7135569/packages/yaml-config/src/lib/decorators.ts#L69)

___

### EnvironmentVariable

▸ **EnvironmentVariable**(`options?`): `PropertyDecorator`

Use this decorator to mark a property in your application configuration as a field that can be provided via environment variable

**`Example`**

```ts
class ApplicationConfig {
  @EnvironmentVariable()
  foo = 'default-value',
 
  @EnvironmentVariable({  variableType: EnvironmentVariableType.NUMBER })
  bar = 123
}
```

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `options` | [`EnvironmentVariableOptions`](README.md#environmentvariableoptions) | Options to set aspects of how this environment variable is loaded |

#### Returns

`PropertyDecorator`

PropertyDecorator

#### Defined in

[lib/decorators.ts:128](https://github.com/pbabbott/home-web-apps/blob/7135569/packages/yaml-config/src/lib/decorators.ts#L128)

___

### loadConfig

▸ **loadConfig**<`T`\>(`defaultConfig`, `configFilePath?`): `Promise`<`T`\>

This function accepts a default config object and optionally a path to a config file in YAML format.
It will then combine these into a single output which will be a deeply merged object where the config file has a higher priority than the default configuration.
In addition, it will respect properties marked by `@EnvironmentVariable` and `@ConfigSection` to load in values via environment variables with the highest priority.

**`Example`**

```ts
const pathToConfigFile = '/etc/my-app/config.yml'

class ApplicationConfig {
  foo = 'default-value',
  bar = 'another-default-value'
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

[lib/config.ts:24](https://github.com/pbabbott/home-web-apps/blob/7135569/packages/yaml-config/src/lib/config.ts#L24)
