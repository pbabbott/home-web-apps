TODO: convert this doc to yeoman.

> [!WARNING]
> This doc is incomplete, and I would like to convert it to yeoman once i have a need to make a new library. For now its just an incomplete set of steps.

Steps

1. Dev Deps

- "@abbottland/typescript-config": "workspace:\*",
- "@types/node": "^20.11.24",
- "typescript": "~5.6.3",

2. tsconfig files

```sh
touch tsconfig.build.json # used for the build
touch tsconfig.json # used for vscode
touch tsconfig.test.json #used for running tests
```

```json
// tsconfig.json
{
  "description": "Typescript configuration for VS Code",
  "extends": "@abbottland/typescript-config/ts-lib.json",
  "compilerOptions": {
    "types": ["jest", "node"]
  }
}
```

```json
// tsconfig.build.json
{
  "description": "Typescript configuration for building the project",
  "extends": "@abbottland/typescript-config/ts-lib.json",
  "compilerOptions": {
    "types": ["node"],
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "**/*.test.ts"]
}
```

```json
{
  "description": "Typescript configuration for running tests",
  "extends": "@abbottland/typescript-config/ts-lib.json",
  "compilerOptions": {
    "noEmit": true,
    "types": ["jest", "node"]
  },
  "include": ["**/*.test.ts"],
  "exclude": ["node_modules"]
}
```

3. src code

```sh
mkdir src
touch src/index.ts
```

```json
"scripts": {
    "build": "tsc -p tsconfig.build.json",
    "clean": "rm -rf dist",
    "test:build": "tsc -p tsconfig.test.json",
    "dev": "tsc -w",
    "lint": "eslint \"src/**/*.ts*\" --max-warnings 0",
    "test:unit": "pnpm run test:build && jest --config jest.unit.config.js"
},
```
