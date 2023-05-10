[@home-web-apps/yaml-config](../README.md) / EnvironmentVariableType

# Enumeration: EnvironmentVariableType

Enum to help with loading environment variables into TypeScript into the proper type

## Table of contents

### Enumeration Members

- [BOOLEAN](EnvironmentVariableType.md#boolean)
- [NUMBER](EnvironmentVariableType.md#number)
- [STRING](EnvironmentVariableType.md#string)

## Enumeration Members

### BOOLEAN

• **BOOLEAN** = ``2``

Environment variable should be as a Boolean.

#### Defined in

[lib/decorators.ts:97](https://github.com/pbabbott/home-web-apps/blob/7135569/packages/yaml-config/src/lib/decorators.ts#L97)

___

### NUMBER

• **NUMBER** = ``1``

Environment variable should be treated as a Number().

#### Defined in

[lib/decorators.ts:91](https://github.com/pbabbott/home-web-apps/blob/7135569/packages/yaml-config/src/lib/decorators.ts#L91)

___

### STRING

• **STRING** = ``0``

Environment variable should be treated as a String.  This is the default option.

#### Defined in

[lib/decorators.ts:86](https://github.com/pbabbott/home-web-apps/blob/7135569/packages/yaml-config/src/lib/decorators.ts#L86)
