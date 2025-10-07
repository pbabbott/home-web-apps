# @abbottland/jest-presets

# Install

Add `@abbottland/jest-presets` to dev dependencies:

```json
{
  "devDependencies": {
    "@abbottland/jest-presets": "workspace:*"
  }
}
```

Then run `pnpm install`

# Usage

## 1 - Setup a jest configuration file

`touch jest.config.ts`

```ts
/** @jest-config-loader ts-node -P tsconfig.test.json */

import type { Config } from 'jest';
import { unitTestPreset } from '@abbottland/jest-presets';

const config: Config = {
  projects: [unitTestPreset],
};

export default config;
```

## 2 - Add dependencies

`package.json`

```json
{
  "devDependencies": {
    "@abbottland/jest-presets": "workspace:*",
    "jest": "catalog:",
    "ts-node": "catalog:",
    "@types/jest": "catalog:"
  }
}
```

## 3 - Setup Scripts

`package.json`

```json
"scripts": {
    "test:unit": "jest --config jest.config.ts --selectProjects unit-tests"
}
```

## 4 - Write some tests

Unit tests will be found in any file named `*.unit.test.ts`

```ts
import { log } from '..';

jest.spyOn(global.console, 'log');

describe('@abbottland/logger', () => {
  it('prints a message', () => {
    log('hello');
    expect(console.log).toHaveBeenCalled();
  });
});
```

## 5 - Setup Integration Tests (optional)

### 5a. Add Preset

Simply add another preset to the `jest.config.ts`

```ts
/** @jest-config-loader ts-node -P tsconfig.test.json */
import type { Config } from 'jest';
import {
  unitTestPreset,
  integrationTestPreset,
} from '@abbottland/jest-presets';

const config: Config = {
  projects: [unitTestPreset, integrationTestPreset],
};

export default config;
```

### 5b. Add script

```json
{
  "scripts": {
    "test:int": "jest --config jest.config.ts --selectProjects integration-tests"
  }
}
```
