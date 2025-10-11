#!/usr/bin/env node
import { abctlSecretsGenerateEnv } from '../src/commands/secrets';

async function main() {
  await abctlSecretsGenerateEnv();
}

main();
