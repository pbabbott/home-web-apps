# yaml-config

Application Configuration management using TypeScript, YAML files, and Environment Variables.

## Table of Contents

- [yaml-config](#yaml-config)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Installing](#installing)
    - [Package Manager](#package-manager)
  - [Examples](#examples)
    - [Basic Example with YAML file](#basic-example-with-yaml-file)
      - [1. Setup Typescript Class](#1-setup-typescript-class)
      - [2. Setup a YAML file](#2-setup-a-yaml-file)
      - [3. Load the configuration](#3-load-the-configuration)
    - [Example with Environment Variables](#example-with-environment-variables)
      - [1. Setup Typescript Class with Decorators](#1-setup-typescript-class-with-decorators)
      - [2. Set Environment Variables](#2-set-environment-variables)
      - [3. Load the configuration](#3-load-the-configuration-1)
- [Contributing](#contributing)
  - [Building](#building)
  - [Running unit tests](#running-unit-tests)
  - [Generating Documentation](#generating-documentation)

*Note:* This Table of Contents is managed by the VS Code Extension: `yzhang.markdown-all-in-one`

## Features

- A `loadConfig()` function to flexibly load application configuration with graduating priority
  1. Environment Variables *(highest priority)*
  2. YAML config file 
  3. Default config defined in TypeScript class *(lowest priority)*
- TypeScript Decorators `@EnvironmentVariable` and `@ConfigSection` to help load config from environment variables
- Use your own TypeScript `class` to manage application configuration with strongly typed properties.
- Load config from a `YAML` file right into an instance of a TypeScript `class`.

## Installing

### Package Manager

Using npm:
```bash
$ npm install @home-web-apps/yaml-config
```

```bash
$ yarn add @home-web-apps/yaml-config
```

Once the package is installed, you can import the library using import or require approach:

```ts
import { loadConfig } from '@home-web-apps/yaml-config'
```

## Examples

### Basic Example with YAML file

#### 1. Setup Typescript Class

Here is where you can specify default values for your configuration.

```ts
class ApplicationConfig {
    oneCoolBoolean = false
    oneCoolNumber = 123
    oneCoolString = 'hello world'
}
```

#### 2. Setup a YAML file
Items in this file will take precedence over the default configuration

```yaml
oneCoolNumber: 100
oneCoolString: 'AWESOME'
```

#### 3. Load the configuration

Put it all together like this!

```ts
import { loadConfig } from '@home-web-apps/yaml-config'

const pathToConfigFile = './config.yml'
const defaultConfig = new ApplicationConfig()
const config = await loadConfig(defaultConfig, pathToConfigFile)
```

The resulting config will be:
```ts
{
    oneCoolBoolean: false,    // default value
    oneCoolNumber: 100,      // loaded from YAML file
    oneCoolString: 'AWESOME' // loaded from YAML file
}
```

### Example with Environment Variables

#### 1. Setup Typescript Class with Decorators

Here is where you can specify default values for your configuration. 

Also you can choose which variables are able to be loaded via environment variables.  It is also possible to override the default environment variable names by adding a `variableName:` to the decorator.

```ts
import { EnvironmentVariable } from '@home-web-apps/yaml-config'

class ApplicationConfig {
    @EnvironmentVariable()
    oneCoolBoolean = false

    @EnvironmentVariable()
    oneCoolNumber = 123
    
    @EnvironmentVariable({ variableName: "CUSTOM_ENVIRONMENT_VARIABLE" })
    oneCoolString = 'hello world'
}
```

#### 2. Set Environment Variables

Environment variables are detected by converting the `camelCasePropertyName` to `UPPER_CASE_SNAKE_CASE`

That is, to specify an environment variable to be loaded into `oneCoolNumber` you would just need to set `ONE_COOL_NUMBER`

Example environment:
```env
# .env file
ONE_COOL_NUMBER=100
CUSTOM_ENVIRONMENT_VARIABLE='AWESOME'
```

#### 3. Load the configuration

Put it together just as before.

```ts
import { loadConfig } from '@home-web-apps/yaml-config'

const defaultConfig = new ApplicationConfig()
const config = await loadConfig(defaultConfig)
```

The resulting config will be:
```ts
{
    oneCoolBoolean: false,    // default value
    oneCoolNumber: 100,      // loaded from YAML file
    oneCoolString: 'AWESOME' // loaded from YAML file
}
```

# Contributing

## Building

Run `nx build yaml-config` to build the library.

## Running unit tests

Run `nx test yaml-config` to execute the unit tests via [Jest](https://jestjs.io).


## Generating Documentation

Run `nx docs yaml-config` to generate documentation files explaining how this library works.
