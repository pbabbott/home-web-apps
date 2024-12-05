[**@abbottland/yaml-config**](../README.md)

***

[@abbottland/yaml-config](../README.md) / ConfigSection

# Function: ConfigSection()

> **ConfigSection**(`options`): `PropertyDecorator`

Use this Property Decorator to mark sub-sections of your configuration.  
Without this decorator, environment variables will not be loaded for this section.

## Parameters

### options

[`ConfigSectionOptions`](../type-aliases/ConfigSectionOptions.md) = `{}`

Options to configure a prefix for environment variables for just this section.

## Returns

`PropertyDecorator`

PropertyDecorator

## Example

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

## Defined in

[decorators.ts:69](https://github.com/pbabbott/home-web-apps/blob/ec00bebc237422af4f5115f844c2c704b35aeb74/packages/yaml-config/src/lib/decorators.ts#L69)
