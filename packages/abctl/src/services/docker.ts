import { ExecaError } from 'execa';
import { executeCommand } from './shell';

export const dockerTag = async (
  imageWithTag: string,
  newImageWithTag: string,
): Promise<void> => {
  try {
    const command = 'docker';
    const args = ['tag', imageWithTag, newImageWithTag];
    await executeCommand(command, args);
  } catch (error) {
    console.error('❌  Docker tag failed:', error);
    process.exit(1);
  }
};

export const dockerPush = async (imageWithTag: string): Promise<void> => {
  try {
    const command = 'docker';
    const args = ['push', imageWithTag];
    await executeCommand(command, args);
  } catch (error) {
    console.error('❌  Docker push failed:', error);
    process.exit(1);
  }
};

export const checkRemoteImageExists = async (
  imageWithTag: string,
): Promise<boolean> => {
  try {
    console.log(
      `🔎 Checking if image ${imageWithTag} exists in the remote registry...`,
    );
    const command = 'docker';
    const args = ['manifest', 'inspect', `${imageWithTag}`];
    await executeCommand(command, args);
    console.log(`⚠️  Image ${imageWithTag} exists in the remote registry.`);
    return true;
  } catch (error) {
    if (error instanceof ExecaError) {
      if (
        (error.message.includes('repository') ||
          error.message.includes('artifact')) &&
        error.message.includes('not found')
      ) {
        console.log(
          `✅  Image ${imageWithTag} does not exist in the remote registry.`,
        );
        return false;
      }
    }
    console.error('An unexpected error occurred:', error);
    process.exit(1);
  }
};

export async function dockerBuildXBuild(image: string, push: boolean = false) {
  try {
    const command = 'docker';
    const args = [
      'buildx',
      'build',
      '-t',
      image,
      '--progress=plain',
      '--platform',
      'linux/amd64,linux/arm64',
    ];

    if (push) {
      args.push('--push');
    }
    args.push('.');

    await executeCommand(command, args);

    console.log(
      `✅  Docker build ${push ? 'and push ' : ''}completed successfully.`,
    );
  } catch (error) {
    console.error('❌  Docker build failed:', error);
    process.exit(1);
  }
}
