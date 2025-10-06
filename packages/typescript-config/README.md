# `tsconfig`

These are base shared `tsconfig.json`s from which all other `tsconfig.json`'s inherit from.

## Table of Contents

- [`tsconfig`](#tsconfig)
  - [Table of Contents](#table-of-contents)
  - [General Package Setup Instructions](#general-package-setup-instructions)
    - [Step 1 - Create a `tsconfig.json`](#step-1---create-a-tsconfigjson)
    - [Step 2 - Setup a build](#step-2---setup-a-build)
    - [Step 3 - Setup Tests](#step-3---setup-tests)
- [Configuration Presets](#configuration-presets)
  - [`ts-server` Configuration Presets](#ts-server-configuration-presets)
    - [`ts-server-base.json`](#ts-server-basejson)
    - [`ts-server-build.json`](#ts-server-buildjson)
    - [`ts-server-test.json`](#ts-server-testjson)
  - [`ts-lib` Configuration Presets](#ts-lib-configuration-presets)
    - [`ts-lib-base.json`](#ts-lib-basejson)
    - [`ts-lib-build.json`](#ts-lib-buildjson)
    - [`ts-lib-test.json`](#ts-lib-testjson)

## General Package Setup Instructions

### Step 1 - Create a `tsconfig.json`

Create a `tsconfig.json` in your package. This configuration is used by VS Code, Cursor, or other IDEs to provide syntax highlighting and IntelliSense.

```jsonc
// tsconfig.json
{
  "description": "Typescript configuration for IDE Support",
  "extends": "@abbottland/typescript-config/ts-server-base.json",
  "compilerOptions": {
    "types": ["jest", "node"],
  },
}
```

> [!NOTE]
> Notice here that types is using both `jest` and `node` which means it should work well both when working with tests and application builds.

### Step 2 - Setup a build

Next, it's time to define what will be built with TypeScript.

Be sure to set `outDir` and `rootDir` in `compilerOptions` as well as `include` and `exclude` properties.

```jsonc
// tsconfig.build.json
{
  "description": "Typescript configuration for building the project",
  "extends": "@abbottland/typescript-config/ts-server-build.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "**/*.test.ts"],
}
```

Add the build script to your `package.json`.

```jsonc
"scripts": {
    "build": "tsc -p tsconfig.build.json",
}
```

> [!NOTE]
> Be sure to check the `include` and `exclude` fields from the base for correctness
>
> Generally, they're set to include `src/` and ignore tests for builds.

> [!IMPORTANT]
> Note that `compilerOptions` like `outDir` and `rootDir` will always be relative to where they are defined. That is, moving these items into a base `tsconfig.json` is not feasible as they would resolve to something like: `packages/typescript-config/src`
>
> The same applies to `include` and `exclude` - they will also resolve to where they are defined - and not where they are used!

### Step 3 - Setup Tests

Next, it's time to set up tests. This can be accomplished by following a similar process.

Be sure to set the `include` field.

```jsonc
{
  "description": "Typescript configuration for running tests",
  "extends": "@abbottland/typescript-config/ts-server-test.json",
  "include": ["**/*.test.ts"],
}
```

# Configuration Presets

## `ts-server` Configuration Presets

The base configuration used for building a service with TypeScript. A service is defined as a runnable program as opposed to a library that exports modules to be imported by other projects.

### `ts-server-base.json`

- Great for use with `tsconfig.json` in a package for IDE support.
- Inherits from `ts-base` to get all general Typescript settings

**Example `tsconfig.json`:**

```jsonc
{
  "description": "Typescript configuration for IDE support",
  "extends": "@abbottland/typescript-config/ts-server-base.json",
  "compilerOptions": {
    "types": ["jest", "node"],
  },
}
```

### `ts-server-build.json`

- Inherits from `ts-server-base.json`
- Appropriate for use to build a service with Typescript
- Features `include` and `exclude` properties. Watch out!

**Example `tsconfig.build.json`:**

```jsonc
{
  "description": "Typescript configuration for building the project",
  "extends": "@abbottland/typescript-config/ts-server-build.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "**/*.test.ts"],
}
```

### `ts-server-test.json`

- Inherits from `ts-server-base.json`
- Appropriate for use to setup tests with Typescript

**Example `tsconfig.test.json`:**

```jsonc
{
  "description": "Typescript configuration for running tests",
  "extends": "@abbottland/typescript-config/ts-server-test.json",
  "include": ["**/*.test.ts"],
}
```

## `ts-lib` Configuration Presets

These are presets for building a TypeScript library (not with React code) using pure TypeScript.

### `ts-lib-base.json`

This configuration should be used for TypeScript libraries to provide IDE support.

**Example `tsconfig.json`:**

```jsonc
{
  "description": "Typescript configuration for IDE support",
  "extends": "@abbottland/typescript-config/ts-lib-base.json",
  "compilerOptions": {
    "types": ["jest", "node"],
  },
}
```

### `ts-lib-build.json`

**Example `tsconfig.build.json`:**

```jsonc
{
  "description": "Typescript configuration for building the project",
  "extends": "@abbottland/typescript-config/ts-lib-build.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
  },
  "include": ["src/**/*.ts"],
  "exclude": ["**/*.test.ts"],
}
```

### `ts-lib-test.json`

**Example `tsconfig.test.json`:**

```jsonc
{
  "description": "Typescript configuration for running tests",
  "extends": "@abbottland/typescript-config/ts-lib-test.json",
  "include": ["**/*.test.ts"],
}
```
