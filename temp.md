eslint

```ts
import { includeIgnoreFile } from '@eslint/compat';
import oclif from 'eslint-config-oclif';
import prettier from 'eslint-config-prettier';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const gitignorePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '.gitignore',
);

export default [includeIgnoreFile(gitignorePath), ...oclif, prettier];
```

tsconfig.json

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "Node16",
    "moduleResolution": "node16",
    "rootDir": "src",
    "outDir": "dist",
    "baseUrl": "src",

    "declaration": true, // exists in ts-lib-base
    "strict": true // exists in ts-lib-base
  },
  "include": ["src/**/*"],
  "ts-node": {
    "esm": true
  }
}
```

old way

```ts

#!/usr/bin/env node

import {execute} from '@oclif/core'

await execute({dir: import.meta.url})

```
