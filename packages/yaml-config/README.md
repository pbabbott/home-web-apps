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
    - [1. Setup a Typescript Class](#1-setup-a-typescript-class)
    - [2. Setup a YAML file](#2-setup-a-yaml-file)
    - [3. Load the configuration](#3-load-the-configuration)
  - [Example with Environment Variables](#example-with-environment-variables)
    - [1. Setup Typescript Class with Decorators](#1-setup-typescript-class-with-decorators)
    - [2. Set Environment Variables](#2-set-environment-variables)
    - [3. Load the configuration](#3-load-the-configuration-1)
  - [Example with All Features](#example-with-all-features)
    - [1. Setup a Typescript Class](#1-setup-a-typescript-class-1)
    - [2. Set Environment Variables \& YAML File](#2-set-environment-variables--yaml-file)
    - [3. Load the configuration](#3-load-the-configuration-2)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
  - [Initial Setup](#initial-setup)
  - [Building](#building)
  - [Running unit tests](#running-unit-tests)
  - [Generating Documentation](#generating-documentation)
  - [Other Commands](#other-commands)

*Note:* This Table of Contents is managed by the VS Code Extension: `yzhang.markdown-all-in-one`

## Features

- A `loadConfig()` function to flexibly load application configuration with graduating priority
  1. Environment Variables *(highest priority)*
  2. YAML config file 
  3. Default config defined in TypeScript class *(lowest priority)*
- TypeScript Decorators `@EnvironmentVariable` and `@ConfigSection` to help load config from environment variables
- Use your own TypeScript `class` to manage application configuration with strongly typed properties.
- Load config from a `YAML` file right into an instance of a TypeScript `class`.

# Installing

### Package Manager

Using npm:
```bash
$ npm install @abbottland/yaml-config
```

```bash
$ yarn add @abbottland/yaml-config
```

Once the package is installed, you can import aspects of the library using import or require approach:

```ts
import { loadConfig } from '@abbottland/yaml-config'
```

# Examples

## Basic Example with YAML file

### 1. Setup a Typescript Class

Here is where you can specify default values for your configuration.

```ts
class ApplicationConfig {
    oneCoolBoolean = false
    oneCoolNumber = 123
    oneCoolString = 'hello world'
}
```

### 2. Setup a YAML file
Items in this file will take precedence over the default configuration

```yaml
# config.yml

oneCoolNumber: 100
oneCoolString: 'AWESOME'
```

### 3. Load the configuration

Put it all together like this!

```ts
import { loadConfig } from '@abbottland/yaml-config'

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

## Example with Environment Variables

Here is a very similar example of how to load config from environment variables instead of a YAML file.

### 1. Setup Typescript Class with Decorators

Similar to the previous example, this is where you can specify default values for your configuration. 

You can also choose which properties of your configuration can be loaded via environment variables. 

```ts
import { EnvironmentVariable } from '@abbottland/yaml-config'

class ApplicationConfig {
    @EnvironmentVariable({ variableType: EnvironmentVariableType.BOOLEAN })
    oneCoolBoolean = false

    @EnvironmentVariable({ variableType: EnvironmentVariableType.NUMBER })
    oneCoolNumber = 123
    
    // More on this in the next section!
    @EnvironmentVariable({ variableName: "CUSTOM_ENVIRONMENT_VARIABLE" })
    oneCoolString = 'hello world'
}
```

*Note:* By default, all properties are treated as `string`, if you want to make sure your environment variables are loaded with the proper type, be sure to specify it!

### 2. Set Environment Variables

Environment variables are detected by converting the `camelCasePropertyName` to `UPPER_CASE_SNAKE_CASE`

That is, to specify an environment variable to be loaded into `oneCoolNumber` you would just need to set `ONE_COOL_NUMBER`

It is also possible to override the default environment variable names by adding a `variableName:` to the decorator.

```env
# .env

ONE_COOL_NUMBER=100
CUSTOM_ENVIRONMENT_VARIABLE='AWESOME'
```

### 3. Load the configuration

Put it together just as before.

```ts
import { loadConfig } from '@abbottland/yaml-config'
import * as dotenv from 'dotenv'

dotenv.config()
const defaultConfig = new ApplicationConfig()
const config = await loadConfig(defaultConfig)
```

The resulting config will be:
```ts
{
    oneCoolBoolean: false,    // default value
    oneCoolNumber: 100,       // loaded from YAML file
    oneCoolString: 'AWESOME'  // loaded from YAML file
}
```

## Example with All Features

### 1. Setup a Typescript Class

```ts
@AppConfig({ appPrefix: 'YAML_CONFIG'})
export class ProjectConfig {
    @EnvironmentVariable()
    oneCoolString = 'hello'

    // Override the variable name so that values can be provided via: YAML_CONFIG_LOGS_VAR_NAME
    // Instead of the default which would normally be: YAML_CONFIG_LOGGING_VAR_NAME
    @ConfigSection({ sectionPrefix: "LOGS" })
    logging = new LoggingConfig()

    @ConfigSection()
    weather = new WeatherConfig()
}

export class LoggingConfig {
    @EnvironmentVariable()
    apiKey = ''

    @EnvironmentVariable()
    level = 'debug'

    format = 'json'
}

export class WeatherConfig {
    @EnvironmentVariable()
    apiKey = ''

    desiredWeather = 'sunny'

    updateFrequency = 'weekly'
}
```

### 2. Set Environment Variables & YAML File

Environment Variables:
```env
# .env

YAML_CONFIG_ONE_COOL_STRING='AWESOME'
YAML_CONFIG_LOGS_API_KEY='superSecretKey!'
YAML_CONFIG_LOGS_LEVEL='info'
YAML_CONFIG_WEATHER_API_KEY='password123'
```

YAML File
```yaml
# config.yml

oneCoolString: 'pretty neat'

logging:
  level: silly
  format: console

weather:
  updateFrequency: 'daily'
```


### 3. Load the configuration

```ts
import { loadConfig } from '@abbottland/yaml-config'
import * as dotenv from 'dotenv'

dotenv.config()
const defaultConfig = new ApplicationConfig()
const config = await loadConfig(defaultConfig)
```

The resulting config will be:
```ts
{
    oneCoolString: 'AWESOME',     // loaded from env 
    logging: {
      apiKey: 'superSecretKey!',  // loaded from env 
      level: 'info',              // loaded from env 
      format: 'console'           // loaded from YAML file
    },
    weather: {
      apiKey: 'password123',      // loaded from env
      desiredWeather: 'sunny',    // default value
      updateFrequency: 'daily',   // loaded from YAML file
    }
}
```
# API Documentation

All exports of this library are documented with TypeDoc.  

[Click here](./docs) to go to the TypeDoc documentation for this project!


# Contributing

All commands should be run from the root of this monorepo using NX.

## Initial Setup
First, ensure you have `nx` installed globally

```bash
npm install -g nx@latest
```

Next, authenticate to private registry by setting the following environment variables:
```env
NPM_REGISTRY_PROTO='https'
NPM_REGISTRY='verdaccio.nas.local.abbottland.io'
NPM_TOKEN='ASK_PEER_DEVELOPER_FOR_THIS_VALUE'
```

Then, restore packages with `yarn`

```bash
yarn
```

Now you are ready to start developing on this project. 🎉

## Building

Run `nx build yaml-config` to build the library.

## Running unit tests

Run `nx test yaml-config` to execute the unit tests via [Jest](https://jestjs.io).

## Generating Documentation

Run `nx docs yaml-config` to generate documentation files explaining how this library works.

## Other Commands

Other NX commands you can run are documented in the `project.json` file. Versioning and deployment is handled by CI.
