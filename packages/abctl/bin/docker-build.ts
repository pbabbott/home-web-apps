#!/usr/bin/env node
import { abctlDockerBuild } from '../src/commands/docker';

async function main() {
  await abctlDockerBuild();
}

main();
