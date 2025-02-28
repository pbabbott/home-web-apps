#!/usr/bin/env node
import { dockerBuild } from '../src/docker';

async function main() {
  await dockerBuild();
}

main();

// Commander code example.
// #!/usr/bin/env node
// import { Command } from 'commander';
// import { dockerBuild } from '../src/docker';

// const program = new Command();

// program
//   .argument('<imageName>', 'Docker image name')
//   .argument('[context]', 'Build context path', '.')
//   .action(async (imageName, context) => {
//     console.log(`Building ${imageName} from ${context}`);
//     await dockerBuild(imageName, context);
//   });

// program.parse();
