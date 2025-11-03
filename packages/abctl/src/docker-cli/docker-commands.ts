import {ExecaError} from 'execa'
import {executeCommand} from './shell.js'
import {DockerBuildSettings} from './docker-build-settings.js'

export const dockerTag = async (imageWithTag: string, newImageWithTag: string): Promise<void> => {
  try {
    const command = 'docker'
    const args = ['tag', imageWithTag, newImageWithTag]
    await executeCommand(command, args)
  } catch (error) {
    console.error('❌  Docker tag failed:', error)
    process.exit(1)
  }
}

export const dockerPush = async (imageWithTag: string): Promise<void> => {
  try {
    const command = 'docker'
    const args = ['push', imageWithTag]
    await executeCommand(command, args)
  } catch (error) {
    console.error('❌  Docker push failed:', error)
    process.exit(1)
  }
}

export const checkRemoteImageExists = async (imageWithTag: string): Promise<boolean> => {
  try {
    console.log(`🔎 Checking if image ${imageWithTag} exists in the remote registry...`)
    const command = 'docker'
    const args = ['manifest', 'inspect', `${imageWithTag}`]
    await executeCommand(command, args)
    console.log(`⚠️  Image ${imageWithTag} exists in the remote registry.`)
    return true
  } catch (error) {
    if (error instanceof ExecaError) {
      if (
        (error.message.includes('repository') || error.message.includes('artifact')) &&
        error.message.includes('not found')
      ) {
        console.log(`✅  Image ${imageWithTag} does not exist in the remote registry.`)
        return false
      }
    }
    console.error('An unexpected error occurred:', error)
    process.exit(1)
  }
}

export async function dockerBuild(settings: DockerBuildSettings) {
  try {
    const {image, context, buildArgs = {}, dockerfile, push, load, platform, target} = settings
    const command = 'docker'
    const args = ['buildx', 'build']

    args.push('--progress=plain')
    args.push('-t', image)
    args.push('-f', dockerfile ?? './Dockerfile')

    Object.entries(buildArgs).forEach(([key, value]) => {
      args.push('--build-arg', `${key}=${value}`)
    })

    if (platform) {
      args.push('--platform', platform)
    }

    if (push) {
      args.push('--push')
    }

    if (load) {
      args.push('--load')
    }

    if (target) {
      args.push('--target', target)
    }

    args.push(context ?? '.')

    await executeCommand(command, args)

    console.log('✅  Docker build completed successfully.')
  } catch (error) {
    console.error('❌  Docker build failed:', error)
    process.exit(1)
  }
}
