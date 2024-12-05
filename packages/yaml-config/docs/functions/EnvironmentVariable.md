[**@abbottland/yaml-config**](../README.md)

***

[@abbottland/yaml-config](../README.md) / EnvironmentVariable

# Function: EnvironmentVariable()

> **EnvironmentVariable**(`options`): `PropertyDecorator`

Use this decorator to mark a property in your application configuration as a field that can be provided via environment variable

## Parameters

### options

[`EnvironmentVariableOptions`](../type-aliases/EnvironmentVariableOptions.md) = `...`

Options to set aspects of how this environment variable is loaded

## Returns

`PropertyDecorator`

PropertyDecorator

## Example

```ts
class ApplicationConfig {
  @EnvironmentVariable()
  foo = 'default-value',
 
  @EnvironmentVariable({  variableType: EnvironmentVariableType.NUMBER })
  bar = 123
}
```

## Defined in

[decorators.ts:128](https://github.com/pbabbott/home-web-apps/blob/ec00bebc237422af4f5115f844c2c704b35aeb74/packages/yaml-config/src/lib/decorators.ts#L128)
