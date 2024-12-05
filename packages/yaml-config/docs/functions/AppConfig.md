[**@abbottland/yaml-config**](../README.md)

***

[@abbottland/yaml-config](../README.md) / AppConfig

# Function: AppConfig()

> **AppConfig**(`options`): `ClassDecorator`

Use this decorator on the root class that manages your application config.  
Presently this is only used to set a prefix for environment variables.

## Parameters

### options

[`AppConfigOptions`](../type-aliases/AppConfigOptions.md) = `{}`

Options to configure a prefix for environment variables

## Returns

`ClassDecorator`

ClassDecorator

## Example

```ts
@AppConfig({ appPrefix: 'YAML_CONFIG' })
class ApplicationConfig {
  @EnvironmentVariable()
  foo = 'default-value',
}
```

## Defined in

[decorators.ts:30](https://github.com/pbabbott/home-web-apps/blob/ec00bebc237422af4f5115f844c2c704b35aeb74/packages/yaml-config/src/lib/decorators.ts#L30)
