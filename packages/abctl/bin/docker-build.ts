#!/usr/bin/env node
import { abctlDockerBuild } from '../src/docker';

async function main() {
  await abctlDockerBuild();
}

main();
