[**@abbottland/yaml-config**](../README.md)

***

[@abbottland/yaml-config](../README.md) / EnvironmentVariableOptions

# Type Alias: EnvironmentVariableOptions

> **EnvironmentVariableOptions**: `object`

These are options that affect just one environment variable of your application configuration.

## Type declaration

### variableName?

> `optional` **variableName**: `string`

Use this to use a custom environment variable name.
By default, the property name will be converted to UPPER_CASE_SNAKE_CASE
NOTE: the suffix

### variableType?

> `optional` **variableType**: [`EnvironmentVariableType`](../enumerations/EnvironmentVariableType.md)

## Defined in

[decorators.ts:103](https://github.com/pbabbott/home-web-apps/blob/ec00bebc237422af4f5115f844c2c704b35aeb74/packages/yaml-config/src/lib/decorators.ts#L103)
