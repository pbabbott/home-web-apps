[**@abbottland/yaml-config**](../README.md)

***

[@abbottland/yaml-config](../README.md) / EnvironmentVariableType

# Enumeration: EnvironmentVariableType

Enum to help with loading environment variables into TypeScript into the proper type

## Enumeration Members

### BOOLEAN

> **BOOLEAN**: `2`

Environment variable should be as a Boolean.

#### Defined in

[decorators.ts:97](https://github.com/pbabbott/home-web-apps/blob/ec00bebc237422af4f5115f844c2c704b35aeb74/packages/yaml-config/src/lib/decorators.ts#L97)

***

### NUMBER

> **NUMBER**: `1`

Environment variable should be treated as a Number().

#### Defined in

[decorators.ts:91](https://github.com/pbabbott/home-web-apps/blob/ec00bebc237422af4f5115f844c2c704b35aeb74/packages/yaml-config/src/lib/decorators.ts#L91)

***

### STRING

> **STRING**: `0`

Environment variable should be treated as a String.  This is the default option.

#### Defined in

[decorators.ts:86](https://github.com/pbabbott/home-web-apps/blob/ec00bebc237422af4f5115f844c2c704b35aeb74/packages/yaml-config/src/lib/decorators.ts#L86)
