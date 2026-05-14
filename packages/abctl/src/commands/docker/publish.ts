import {initConfig} from '../../config/config-loader.js'
import {checkRemoteImageExists, dockerBuild} from '../../docker-cli/docker-commands.js'
import {combineBuildConfigs} from '../../build-logic/build-config-merger/build-config-merger.js'
import {makeBuildSettings} from '../../build-logic/docker-build-settings-builder/docker-build-settings-builder.js'
import {getImageAsLatest, getImageWithVersion} from '../../build-logic/image-reference/image-reference.js'
import {getProjectMetadata} from '../../build-logic/project-metadata.js'
import {BaseCommand} from '../../baseCommand.js'

export default class Publish extends BaseCommand {
  static args = {}
  static description = 'Publish a Docker image for the current project'
  static examples = [
    `<%= config.bin %> <%= command.id %>
publish the Docker image for the current project
`,
  ]

  async run(): Promise<void> {
    const {flags} = await this.parse(Publish)
    console.log('🏎️  Starting docker publish process...')
    // Read and combine the config with any presets
    const config = await initConfig(flags.config)
    const combinedBuildConfig = combineBuildConfigs(config)

    // Get metadata regarding the project, dir, and version
    const projectMetadata = getProjectMetadata()

    // Determine a versioned image name & latest image name
    const imageWithVersion = getImageWithVersion(projectMetadata, combinedBuildConfig)
    const imageAsLatest = getImageAsLatest(projectMetadata, combinedBuildConfig)
    console.log(`🎯 Target image is ${imageWithVersion}`)

    const remoteImageExists = await checkRemoteImageExists(imageWithVersion)
    if (remoteImageExists) {
      console.log('⚠️  Nothing to do. Skipping push. Program terminated.')
      return
    }

    // Finally run docker build making the build settings
    const dockerBuildSettings = makeBuildSettings(imageWithVersion, combinedBuildConfig, projectMetadata)
    dockerBuildSettings.push = true

    // This will perform a push on the versioned image
    await dockerBuild(dockerBuildSettings)

    // This will perform a push on the latest image
    dockerBuildSettings.image = imageAsLatest
    await dockerBuild(dockerBuildSettings)
  }
}
