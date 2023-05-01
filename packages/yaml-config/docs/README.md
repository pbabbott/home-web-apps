@home-web-apps/yaml-config

# @home-web-apps/yaml-config

## Table of contents

### Functions

- [loadConfig](README.md#loadconfig)

## Functions

### loadConfig

▸ **loadConfig**<`T`\>(`configFilePath`, `defaultConfig`): `Promise`<`T`\>

This function looks for a config file in YAML format and a default config object.  
The output will be a deeply merged object where the config file has higher priority than the default configuration

**`Example`**

```ts
loadConfig('/etc/my-app/config.yml', { foo: 'default-value', bar: 'another-default-value' })
```

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `configFilePath` | `string` | The path to the YAML configuration file |
| `defaultConfig` | `T` | The default configuration to use |

#### Returns

`Promise`<`T`\>

A strongly-typed object with all properties loaded.

#### Defined in

[lib/config.ts:15](https://github.com/pbabbott/home-web-apps/blob/8924fb2/packages/yaml-config/src/lib/config.ts#L15)
