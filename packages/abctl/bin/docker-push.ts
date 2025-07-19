#!/usr/bin/env node
import { abctlDockerPublish } from '../src/commands/docker';

async function main() {
  await abctlDockerPublish();
}

main();
